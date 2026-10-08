import { Config } from "./ui/Config";
import { GetStarted } from "./ui/GetStarted";
import { Hero } from "./ui/Hero";
import { Included } from "./ui/Included";
import { Screens } from "./ui/Screens";

export function Landing() {
  return (
    <main id="main">
      <Hero />
      <Config />
      <Screens />
      <Included />
      <GetStarted />
    </main>
  );
}
