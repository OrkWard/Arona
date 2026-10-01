import { AppConfig } from "./config.js";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface JevChoiceCandidate<T = unknown> {
  id: string;
  description: JsonValue;
  value: T;
}

export interface JevChoiceResult<T> {
  value: T;
  candidateId: string;
  confidence: number;
  probabilities: Record<string, number>;
  usage?: { input_tokens: number; output_tokens: number };
}

type JevChoiceAnswer = {
  type?: string;
  choice?: string;
  confidence?: number;
  probabilities?: Record<string, number>;
};

type JevResponse = {
  answers?: Record<string, JevChoiceAnswer>;
  usage?: { input_tokens: number; output_tokens: number };
};

export class JevService {
  static inject = ["config"] as const;

  constructor(private config: AppConfig) {}

  private async request(
    state: JsonValue,
    questions: Record<string, { type: "choice"; instructions: JsonValue; criteria: Record<string, JsonValue> }>
  ): Promise<JevResponse> {
    const body = JSON.stringify({ model: "jev-latest", state, questions });
    const response = await fetch(this.config.jevOrigin, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.jevApiKey}`,
        "Content-Type": "application/json",
      },
      body,
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`JEV request failed with HTTP ${response.status}: ${detail}`);
    }
    return (await response.json()) as JevResponse;
  }

  private readChoice<T>(payload: JevResponse, questionId: string, byId: Map<string, JevChoiceCandidate<T>>) {
    const answer = payload.answers?.[questionId];
    if (
      answer?.type !== "choice" ||
      typeof answer.choice !== "string" ||
      typeof answer.confidence !== "number" ||
      !answer.probabilities
    ) {
      throw new Error(`JEV returned an invalid choice response for ${questionId}`);
    }

    const selected = byId.get(answer.choice);
    if (!selected) {
      throw new Error(`JEV selected unknown candidate for ${questionId}: ${answer.choice}`);
    }
    return { selected, answer };
  }

  /** Run one choice question per batch in a single request and return every batch winner. */
  async chooseBatchWinners<T>(params: {
    state: JsonValue;
    instructions: JsonValue;
    candidates: JevChoiceCandidate<T>[];
  }): Promise<{ winners: JevChoiceResult<T>[]; usage?: { input_tokens: number; output_tokens: number } }> {
    const batchCount = Math.ceil(params.candidates.length / 255);
    const batchSize = Math.ceil(params.candidates.length / batchCount);
    const questions: Record<string, { type: "choice"; instructions: JsonValue; criteria: Record<string, JsonValue> }> = {};
    const candidateMaps = new Map<string, Map<string, JevChoiceCandidate<T>>>();

    for (let offset = 0, batch = 0; offset < params.candidates.length; offset += batchSize, batch++) {
      const questionId = `batch_${batch}`;
      const candidates = params.candidates.slice(offset, offset + batchSize);
      const mapped = new Map(candidates.map((candidate, index) => [`c${index}`, candidate]));
      candidateMaps.set(questionId, mapped);
      questions[questionId] = {
        type: "choice",
        instructions: params.instructions,
        criteria: Object.fromEntries([...mapped].map(([id, candidate]) => [id, candidate.description])),
      };
    }

    const payload = await this.request(params.state, questions);
    const winners = [...candidateMaps].map(([questionId, candidates]) => {
      const { selected, answer } = this.readChoice(payload, questionId, candidates);
      return {
        value: selected.value,
        candidateId: selected.id,
        confidence: answer.confidence!,
        probabilities: answer.probabilities!,
      };
    });
    return { winners, usage: payload.usage };
  }
}
