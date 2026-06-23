import { flagDemandForMunicipalityInteraction } from "@/lib/municipality-portal-notifications"

export async function safeFlagDemandForMunicipalityInteraction(input: {
  demandaId: string
  protocolo: string
}) {
  try {
    await flagDemandForMunicipalityInteraction(input)
  } catch (error) {
    console.error("MUNICIPALITY_PORTAL_SIGNAL_ERROR", error)
  }
}
