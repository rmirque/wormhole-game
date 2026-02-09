// Debug utilities for tracing game events
export const DEBUG = {
  enabled: true,
  
  log(event: string, data?: unknown): void {
    if (!this.enabled) return;
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] ${event}`, data !== undefined ? data : '');
  },
  
  logBotAction(botId: string, action: string, data?: unknown): void {
    this.log(`[BOT:${botId}] ${action}`, data);
  },
  
  logAttackFlow(step: string, data?: unknown): void {
    this.log(`[ATTACK:${step}]`, data);
  },
  
  logGridState(gridId: string, action: string, data?: unknown): void {
    this.log(`[GRID:${gridId}] ${action}`, data);
  }
};
