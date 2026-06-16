export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return

  const { startCoreAutomaticScheduler } = await import("./lib/judicial-core-automatic-scheduler")
  startCoreAutomaticScheduler()
}
