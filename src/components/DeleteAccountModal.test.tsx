import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeleteAccountModal from "./DeleteAccountModal";
import { deleteAccount, usesPassword } from "../services/account";

vi.mock("../services/account", () => ({ deleteAccount: vi.fn(), usesPassword: vi.fn() }));
const del = vi.mocked(deleteAccount);

describe("DeleteAccountModal", () => {
  beforeEach(() => {
    del.mockReset();
    vi.mocked(usesPassword).mockReturnValue(true);
  });

  const open = () => render(<DeleteAccountModal isOpen email="me@example.com" onClose={vi.fn()} />);
  const button = () => screen.getByRole("button", { name: "Delete account" });

  it("stays disabled until the email and password are entered", () => {
    open();
    expect(button()).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: "ME@example.com" } });
    expect(button()).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pw" } });
    expect(button()).toBeEnabled();
  });

  it("shows why deletion failed and lets the user try again", async () => {
    del.mockRejectedValueOnce(new Error("That password is incorrect."));
    open();
    fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: "me@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(button());
    expect(await screen.findByRole("alert")).toHaveTextContent("That password is incorrect.");
    expect(del).toHaveBeenCalledWith("wrong");
    expect(button()).toBeEnabled();
  });

  it("asks Google accounts to sign in again instead of a password", () => {
    vi.mocked(usesPassword).mockReturnValue(false);
    open();
    expect(screen.queryByLabelText("Password")).toBeNull();
    fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: "me@example.com" } });
    expect(button()).toBeEnabled();
  });
});
