import { ConfigResult } from "./ui/ConfigResult";
import { CustomizationLayers } from "./ui/CustomizationLayers";
import { FeatureGrid } from "./ui/FeatureGrid";
import { Hero } from "./ui/Hero";
import { ReadyToShip } from "./ui/ReadyToShip";
import { ThreeSteps } from "./ui/ThreeSteps";

export function Landing() {
  return (
    <main id="main">
      <Hero />
      <ConfigResult />
      <ThreeSteps />
      <FeatureGrid />
      <CustomizationLayers />
      <ReadyToShip />
    </main>
  );
}
