#!/bin/sh
# The collector's private install does not need to be on the agent's PATH.
if command -v agentlog >/dev/null 2>&1; then
  exec agentlog "$@"
fi
agentlog_executable="${HOME}/.local/share/astack/observatory/bin/agentlog"
if [ -x "$agentlog_executable" ]; then
  exec "$agentlog_executable" "$@"
fi
printf '%s\n' 'agentlog is unavailable: no command or private collector install found.' >&2
exit 127
