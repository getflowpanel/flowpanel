import { ConfigResult } from "./ui/ConfigResult";
import { CustomizationLayers } from "./ui/CustomizationLayers";
import { FeatureGrid } from "./ui/FeatureGrid";
import { Hero } from "./ui/Hero";
import { ProductionModel } from "./ui/ProductionModel";
import { ReadyToShip } from "./ui/ReadyToShip";
import { SeeItRunning } from "./ui/SeeItRunning";
import { ThreeSteps } from "./ui/ThreeSteps";

export function Landing() {
  return (
    <main id="main">
      <Hero />
      <ProductionModel />
      <ConfigResult />
      <ThreeSteps />
      <FeatureGrid />
      <CustomizationLayers />
      <SeeItRunning />
      <ReadyToShip />
    </main>
  );
}
