import { customers } from "./customers";
import { monitors } from "./monitors";
import { runs } from "./runs";
import { invoices } from "./invoices";

export const resources = [customers, monitors, runs, invoices] as const;
