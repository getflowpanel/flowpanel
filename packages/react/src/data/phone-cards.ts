"use client";
import { deferredModule } from "../ui/deferred";

/** Phone cards load on a phone only; a wider screen never needs them. */
export const phoneCards = deferredModule(() => import("./MobileCardFold"));

/** Loads the phone cards' code now, as a test setup does. */
export const preloadPhoneCards = () => phoneCards.ensure();
