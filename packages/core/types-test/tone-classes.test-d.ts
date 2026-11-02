import { type Tone, toneFillClass, toneTextClass } from "@flowpanel/core";
import { expectType } from "tsd";

expectType<Record<Tone, string>>(toneTextClass);
expectType<Record<Tone, string>>(toneFillClass);
