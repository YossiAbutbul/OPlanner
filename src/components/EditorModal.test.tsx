import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EditorModal from "./EditorModal";

const base = { isOpen: true, onClose: vi.fn(), noun: "task", canSave: true, onSave: vi.fn() };

describe("EditorModal", () => {
  it("has no Delete for something new", () => {
    render(
      <EditorModal {...base} isEdit={false} onDelete={vi.fn()}>
        <input aria-label="Name" />
      </EditorModal>
    );
    expect(screen.getByText("New task")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("asks before deleting, then closes", async () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(
      <EditorModal {...base} onClose={onClose} isEdit itemName="Read ch. 3" onDelete={onDelete}>
        <input aria-label="Name" />
      </EditorModal>
    );
    expect(screen.getByText("Edit task")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Delete “Read ch. 3”? This can't be undone.")).toBeInTheDocument();
    const confirm = screen.getAllByRole("button", { name: "Delete" }).at(-1)!;
    fireEvent.click(confirm);
    await waitFor(() => expect(onDelete).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
