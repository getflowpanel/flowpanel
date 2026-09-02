import { NextResponse } from "next/server";
import { DEMO_ROLE_COOKIE, toDemoRole } from "@/src/demo/auth/role";

export async function POST(req: Request) {
  const form = await req.formData();
  const requested = form.get("role");
  const role = toDemoRole(requested);
  // Relative: behind a proxy `req.url` names the internal origin, not the public one.
  const response = new NextResponse(null, { status: 303, headers: { Location: "/admin" } });
  response.cookies.set(DEMO_ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
