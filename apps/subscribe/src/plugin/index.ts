export interface AronaPlugin {
  activate(): void;
  deactivate(): void;

  /** For one-time usage, not all plugin has this */
  run?: () => void;
}
