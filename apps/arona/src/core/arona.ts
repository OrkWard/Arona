// onebot.onMessage((msg) => {
//   let command = "";
//   if (
//     !Array.isArray(msg.message) ||
//     !msg.message[0]?.type ||
//     !(msg.message[0].type === "text") ||
//     !msg.message[0].data.text.startsWith("/")
//   ) {
//     return;
//   }
//   command = msg.message[0].data.text.slice(1);
//   if (msg.sender.user_id !== parseInt(process.env.QQ_ADMIN_ID)) {
//     logger.warn(`User ${msg.sender.user_id} send a command, ignore`);
//     return;
//   }

//   const commands = command.split(" ");
//   switch (commands[0]) {
//     case "d":
//       deactivatePlugin(commands[1]);
//       break;
//     case "a":
//       activatePlugin(commands[1]);
//       break;
//   }
// });
