import { TrpcProvider } from "@/src/components/TrpcProvider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <TrpcProvider>{children}</TrpcProvider>;
}
