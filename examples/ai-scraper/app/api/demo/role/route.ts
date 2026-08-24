import { NextResponse } from "next/server";
import { DEMO_ROLE_COOKIE, type DemoRole } from "@/src/demo/auth/role";

export async function POST(req: Request) {
  const form = await req.formData();
  const requested = form.get("role");
  const role: DemoRole = requested === "support" ? "support" : "admin";
  const response = NextResponse.redirect(new URL("/admin", req.url), 303);
  response.cookies.set(DEMO_ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
