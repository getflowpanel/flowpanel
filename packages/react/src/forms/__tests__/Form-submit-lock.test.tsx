// @vitest-environment jsdom

import { DEFAULT_LABELS } from "@flowpanel/core/labels";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Drawer } from "../../shell/Drawer";
import { Field } from "../Field";
import { Form } from "../Form";
import { FormError } from "../FormError";
import { FormSubmit } from "../FormSubmit";
import { confirmLeave } from "../leave-guard";

const push = vi.fn();
const nav = vi.hoisted(() => ({ pathname: "/admin/users" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push }),
}));

const success = vi.fn();
vi.mock("../../feedback/toast-api", () => ({
  useToast: () => ({ success, error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
  success.mockReset();
});

afterEach(() => {
  cleanup();
});

const schema = z.object({ name: z.unknown().optional(), email: z.unknown().optional() });

function typeName(value: string) {
  act(() => {
    fireEvent.input(screen.getByLabelText("Name"), { target: { value } });
  });
}

function renderForm(props: { redirectTo?: string; successMessage?: string } = {}) {
  return render(
    <>
      <a href="/admin/runs">Runs</a>
      <Form action="/api/flowpanel/users/create" schema={schema} {...props}>
        <FormError />
        <Field name="name" label="Name" />
        <Field name="email" label="Email" required />
        <FormSubmit>Create</FormSubmit>
      </Form>
    </>,
  );
}

const reply = (body: object, ok = true) => ({ ok, json: async () => body });

describe("Form submits once at a time", () => {
  it("sends one request for a double click and stays locked through the redirect", async () => {
    fetchMock.mockResolvedValue(reply({ ok: true, createdKey: "7" }));
    renderForm({ redirectTo: "/admin/users", successMessage: "User created" });
    const button = screen.getByRole("button", { name: "Create" });

    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/users?fp_created=7"));
    act(() => {
      fireEvent.click(button);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(success).toHaveBeenCalledWith("User created");
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  it("unlocks after a refused submit so the next click sends again", async () => {
    fetchMock.mockResolvedValue(
      reply({ ok: false, fieldErrors: { email: "Email is required" } }, false),
    );
    renderForm({ redirectTo: "/admin/users" });
    const button = screen.getByRole("button", { name: "Create" });

    act(() => {
      fireEvent.click(button);
    });
    await screen.findByText("Email is required");
    expect(button.hasAttribute("aria-disabled")).toBe(false);
    expect((button as HTMLButtonElement).disabled).toBe(false);

    act(() => {
      fireEvent.click(button);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(push).not.toHaveBeenCalled();
  });
});

describe("Form errors", () => {
  it("shows no banner when every error sits under its field", async () => {
    fetchMock.mockResolvedValue(
      reply(
        { ok: false, error: "Validation failed", fieldErrors: { email: "Email is required" } },
        false,
      ),
    );
    renderForm();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Create" }));
    });
    await screen.findByText("Email is required");
    expect(screen.queryByText("Validation failed")).toBeNull();
    expect(screen.queryAllByRole("alert").map((node) => node.textContent)).toEqual([
      "Email is required",
    ]);
  });

  it("puts an error for a field the form does not show in the banner", async () => {
    fetchMock.mockResolvedValue(
      reply(
        { ok: false, error: "Validation failed", fieldErrors: { plan: "Plan is required" } },
        false,
      ),
    );
    renderForm();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Create" }));
    });
    expect(await screen.findByText("Plan is required")).toBeTruthy();
    expect(screen.queryByText("Validation failed")).toBeNull();
  });

  it("says the browser is offline when the request cannot leave", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderForm();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Create" }));
    });
    expect(await screen.findByText(DEFAULT_LABELS.errors.offline)).toBeTruthy();
    onLine.mockRestore();
  });
});

describe("Form leave guard", () => {
  it("asks before an in-app link drops typed changes, and follows the link on Discard", async () => {
    renderForm();
    act(() => {
      fireEvent.input(screen.getByLabelText("Name"), { target: { value: "Ann" } });
    });

    act(() => {
      fireEvent.click(screen.getByRole("link", { name: "Runs" }));
    });
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain(DEFAULT_LABELS.saving.unsavedTitle);
    expect(push).not.toHaveBeenCalled();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: DEFAULT_LABELS.saving.discard }));
    });
    expect(push).toHaveBeenCalledWith("/admin/runs");
  });

  it("lets a link through while the form is untouched", () => {
    renderForm();
    act(() => {
      fireEvent.click(screen.getByRole("link", { name: "Runs" }));
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("Form lock release and clean state", () => {
  it("takes input again when the redirect keeps the form on screen", async () => {
    fetchMock.mockResolvedValue(reply({ ok: true }));
    renderForm({ redirectTo: window.location.pathname });
    const button = screen.getByRole("button", { name: "Create" });
    act(() => {
      fireEvent.click(button);
    });
    await waitFor(() => expect(push).toHaveBeenCalled());
    await waitFor(() => expect(button.hasAttribute("aria-disabled")).toBe(false));
    act(() => {
      fireEvent.click(button);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("takes input again when the path changes under a form that stayed mounted", async () => {
    fetchMock.mockResolvedValue(reply({ ok: true }));
    const view = renderForm({ redirectTo: "/admin/users/7" });
    const button = screen.getByRole("button", { name: "Create" });
    act(() => {
      fireEvent.click(button);
    });
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(button.getAttribute("aria-disabled")).toBe("true");
    nav.pathname = "/admin/users/7";
    view.rerender(
      <Form action="/api/flowpanel/users/create" schema={schema} redirectTo="/admin/users/7">
        <Field name="name" label="Name" />
        <FormSubmit>Create</FormSubmit>
      </Form>,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create" }).hasAttribute("aria-disabled")).toBe(
        false,
      ),
    );
    nav.pathname = "/admin/users";
  });

  it("is clean after a save that stays on the page", async () => {
    fetchMock.mockResolvedValue(reply({ ok: true }));
    renderForm({ successMessage: "Changes saved" });
    typeName("Ann");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Create" }));
    });
    await waitFor(() => expect(success).toHaveBeenCalledWith("Changes saved"));
    act(() => {
      fireEvent.click(screen.getByRole("link", { name: "Runs" }));
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("the saved snapshot", () => {
  it("counts text typed while the save was in flight as unsaved", async () => {
    let answer: (value: unknown) => void = () => undefined;
    fetchMock.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    renderForm();
    typeName("Ann");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Create" }));
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    typeName("Ann Lee");
    await act(async () => {
      answer(reply({ ok: true }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("link", { name: "Runs" }));
    });
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
  });
});

describe("leaving a dirty form by other means", () => {
  it("asks before a command palette jump, through confirmLeave", async () => {
    renderForm();
    typeName("Ann");
    const proceed = vi.fn();
    act(() => confirmLeave(proceed));
    await screen.findByRole("alertdialog");
    expect(proceed).not.toHaveBeenCalled();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: DEFAULT_LABELS.saving.discard }));
    });
    expect(proceed).toHaveBeenCalledTimes(1);
  });

  it("asks before Esc, the overlay or the close button drop a drawer form", async () => {
    const close = vi.fn();
    render(
      <Drawer open onOpenChange={(open) => (open ? undefined : confirmLeave(close))} title="New">
        <Form action="/api/flowpanel/users/create" schema={schema}>
          <Field name="name" label="Name" />
        </Form>
      </Drawer>,
    );
    typeName("Ann");
    act(() => {
      fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Escape" });
    });
    await screen.findByRole("alertdialog");
    expect(close).not.toHaveBeenCalled();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: DEFAULT_LABELS.saving.keepEditing }));
    });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
    });
    await screen.findByRole("alertdialog");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: DEFAULT_LABELS.saving.discard }));
    });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("closes an untouched drawer form at once", () => {
    const close = vi.fn();
    render(
      <Drawer open onOpenChange={(open) => (open ? undefined : confirmLeave(close))} title="New">
        <Form action="/api/flowpanel/users/create" schema={schema}>
          <Field name="name" label="Name" />
        </Form>
      </Drawer>,
    );
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
    });
    expect(close).toHaveBeenCalledTimes(1);
  });
});
