export function jobErrorReason(message: string): string {
  if (/insufficient credits|no credits|not enough credits/i.test(message)) return 'Not enough credits. Add credits to continue.';
  if (/WorkspaceFeignClient|workspaceservice|repo-url/i.test(message)) return "Couldn't load the project repository.";
  if (/getGithubToken|github\/token|github\/internal\/token/i.test(message)) return "Couldn't access the GitHub connection. Reconnect GitHub in Connect.";
  if (/invalid.*api.?key|incorrect api key|api.?key.*invalid|provider rejected api key/i.test(message)) return 'The AI provider key is invalid.';
  if (/rate.?limit|too many requests/i.test(message)) return 'The AI provider is busy. Try again shortly.';
  if (/timed? out|timeout/i.test(message)) return 'The request timed out. Try again.';
  if (/network error|ECONN|connection refused/i.test(message)) return "Couldn't connect to the server.";
  if (/^\s*\{/.test(message)) {
    try {
      const data = JSON.parse(message);
      const reason = data.errorMessage ?? data.message;
      if (typeof reason === 'string') return jobErrorReason(reason);
    } catch { /* Fall back to a safe reason for malformed responses. */ }
  }
  if (/Feign|Exception|https?:\/\/|during \[(GET|POST|PUT|DELETE)\]|INTERNAL_SERVER_ERROR|\bat [\w.]+\(/i.test(message)) {
    return "The agent couldn't complete the request. Try again.";
  }
  const reason = message.replace(/^\s*\[?\d{3}\]?\s*[:–-]?\s*/, '').trim();
  return reason ? reason.slice(0, 180) : "The agent couldn't complete the request. Try again.";
}

