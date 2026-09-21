/**
 * @deprecated Sites-only ChatGPT SIWC helpers. The Workers host uses Google
 * OpenID via `app/auth.ts`. These names remain so older imports keep compiling.
 */
export {
  getUser as getChatGPTUser,
  requireUser as requireChatGPTUser,
  signInPath as chatGPTSignInPath,
  signOutPath as chatGPTSignOutPath,
  type VaultUser as ChatGPTUser,
} from "./auth";
