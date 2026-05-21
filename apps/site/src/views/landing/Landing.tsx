import { SiteFooter } from "@/widgets/site-footer";
import { SiteHeader } from "@/widgets/site-header";
import { CustomizationLayers } from "./ui/CustomizationLayers";
import { Hero } from "./ui/Hero";
import { ReadyToShip } from "./ui/ReadyToShip";
import { ThreeSteps } from "./ui/ThreeSteps";

export function Landing() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <ThreeSteps />
        <CustomizationLayers />
        <ReadyToShip />
      </main>
      <SiteFooter />
    </>
  );
}
