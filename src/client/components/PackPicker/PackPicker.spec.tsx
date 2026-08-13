import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PackPicker } from "./PackPicker";
import type { BuiltinPackInfo } from "@/shared/types";
import type { WordPack } from "@/client/lib/wordPack";

const builtinPacks: BuiltinPackInfo[] = [
  { id: "software-development-easy", name: "Software Development — Easy", description: "Core dev terms", wordCount: 15 },
  { id: "animals-of-the-sea-hard", name: "Animals of the Sea — Hard", description: "Marine life", wordCount: 15 },
  { id: "mcp-medium", name: "Model Context Protocol (MCP) — Medium", description: "Protocol terms", wordCount: 15 },
];

const localPacks: WordPack[] = [
  { id: "l1", name: "My Custom Pack", words: [{ word: "signal", hint: "a message" }], createdAt: 0, source: "local" },
];

function setup(overrides: Partial<React.ComponentProps<typeof PackPicker>> = {}) {
  const onSelect = vi.fn();
  const onManagePacks = vi.fn();
  render(
    <PackPicker
      builtinPacks={builtinPacks}
      localPacks={localPacks}
      activePackName={null}
      onSelect={onSelect}
      onManagePacks={onManagePacks}
      {...overrides}
    />,
  );
  return { onSelect, onManagePacks };
}

describe("PackPicker", () => {
  it("shows the default label when no pack is active", () => {
    setup();
    expect(screen.getByRole("button", { name: /default/i })).toBeInTheDocument();
  });

  it("shows the active pack name in the trigger", () => {
    setup({ activePackName: "Animals of the Sea — Hard" });
    expect(screen.getByRole("button", { name: /animals of the sea/i })).toBeInTheDocument();
  });

  it("opens a search panel listing every pack on click", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /default/i }));
    expect(screen.getByPlaceholderText(/search packs/i)).toBeInTheDocument();
    expect(screen.getByText("Software Development — Easy")).toBeInTheDocument();
    expect(screen.getByText("Animals of the Sea — Hard")).toBeInTheDocument();
    expect(screen.getByText("My Custom Pack")).toBeInTheDocument();
  });

  it("sorts alphabetically by default (Animals before Software)", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /default/i }));
    // Scope to the listbox so the sort <select>'s own <option>s aren't counted.
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    // options[0] is the pinned Default row; options[1] is the first real pack.
    expect(options[1].textContent).toContain("Animals of the Sea — Hard");
  });

  it("filters packs by the search query", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /default/i }));
    fireEvent.change(screen.getByPlaceholderText(/search packs/i), { target: { value: "sea" } });
    expect(screen.getByText("Animals of the Sea — Hard")).toBeInTheDocument();
    expect(screen.queryByText("Software Development — Easy")).not.toBeInTheDocument();
  });

  it("matches multi-word queries across name and difficulty (AND search)", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /default/i }));
    fireEvent.change(screen.getByPlaceholderText(/search packs/i), { target: { value: "sea hard" } });
    expect(screen.getByText("Animals of the Sea — Hard")).toBeInTheDocument();
    // "Easy" variant must be excluded because it lacks the "hard" token.
    expect(screen.queryByText("Software Development — Easy")).not.toBeInTheDocument();
  });

  it("selects a built-in pack with the correct builtin ref", () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByRole("button", { name: /default/i }));
    fireEvent.click(screen.getByText("Model Context Protocol (MCP) — Medium"));
    expect(onSelect).toHaveBeenCalledWith({ type: "builtin", packId: "mcp-medium" });
  });

  it("selects a local pack as a custom ref", () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByRole("button", { name: /default/i }));
    fireEvent.click(screen.getByText("My Custom Pack"));
    expect(onSelect).toHaveBeenCalledWith({
      type: "custom",
      name: "My Custom Pack",
      words: [{ word: "signal", hint: "a message" }],
    });
  });

  it("clears to the default word bank when Default is chosen", () => {
    const { onSelect } = setup({ activePackName: "Animals of the Sea — Hard" });
    fireEvent.click(screen.getByRole("button", { name: /animals of the sea/i }));
    fireEvent.click(screen.getByText(/default \(server word bank\)/i));
    expect(onSelect).toHaveBeenCalledWith({ type: "clear" });
  });

  it("selects the top result on Enter", () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByRole("button", { name: /default/i }));
    fireEvent.change(screen.getByPlaceholderText(/search packs/i), { target: { value: "mcp" } });
    fireEvent.keyDown(screen.getByPlaceholderText(/search packs/i), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith({ type: "builtin", packId: "mcp-medium" });
  });

  it("shows an empty state when nothing matches", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /default/i }));
    fireEvent.change(screen.getByPlaceholderText(/search packs/i), { target: { value: "zzzzz" } });
    expect(screen.getByText(/no packs match/i)).toBeInTheDocument();
  });

  it("opens the My Packs manager", () => {
    const { onManagePacks } = setup();
    fireEvent.click(screen.getByRole("button", { name: /default/i }));
    fireEvent.click(screen.getByRole("button", { name: /my packs/i }));
    expect(onManagePacks).toHaveBeenCalledOnce();
  });
});

describe("PackPicker — multi-select", () => {
  function setupMulti(selectedKeys: string[] = []) {
    const onSelectMany = vi.fn();
    render(
      <PackPicker
        builtinPacks={builtinPacks}
        localPacks={localPacks}
        activePackName={null}
        onSelect={vi.fn()}
        onManagePacks={vi.fn()}
        multiSelect
        selectedKeys={selectedKeys}
        onSelectMany={onSelectMany}
      />,
    );
    return { onSelectMany };
  }

  it("adds a pack to the selection without dropping the others", () => {
    const { onSelectMany } = setupMulti(["builtin:mcp-medium"]);
    fireEvent.click(screen.getByRole("button", { name: /1 pack/i }));
    fireEvent.click(screen.getByText("Software Development — Easy"));

    expect(onSelectMany).toHaveBeenCalledWith([
      { type: "builtin", packId: "mcp-medium" },
      { type: "builtin", packId: "software-development-easy" },
    ]);
  });

  it("removes a pack that is already selected", () => {
    const { onSelectMany } = setupMulti(["builtin:mcp-medium", "builtin:software-development-easy"]);
    fireEvent.click(screen.getByRole("button", { name: /2 packs/i }));
    fireEvent.click(screen.getByText("Model Context Protocol (MCP) — Medium"));

    expect(onSelectMany).toHaveBeenCalledWith([{ type: "builtin", packId: "software-development-easy" }]);
  });

  it("keeps the panel open so several packs can be stacked in one pass", () => {
    setupMulti();
    fireEvent.click(screen.getByRole("button", { name: /default/i }));
    fireEvent.click(screen.getByText("Software Development — Easy"));

    expect(screen.getByPlaceholderText(/search packs/i)).toBeInTheDocument();
  });

  it("summarises the selection and its total word count in the trigger", () => {
    setupMulti(["builtin:mcp-medium", "builtin:software-development-easy"]);
    expect(screen.getByRole("button", { name: /2 packs · 30 words/i })).toBeInTheDocument();
  });

  it("clears everything through the default row", () => {
    const { onSelectMany } = setupMulti(["builtin:mcp-medium"]);
    fireEvent.click(screen.getByRole("button", { name: /1 pack/i }));
    fireEvent.click(screen.getByText(/server word bank/i));

    expect(onSelectMany).toHaveBeenCalledWith([]);
  });

  it("matches a local pack by name, the way the server keys it", () => {
    const { onSelectMany } = setupMulti(["custom:My Custom Pack"]);
    fireEvent.click(screen.getByRole("button", { name: /1 pack/i }));
    fireEvent.click(screen.getByText("My Custom Pack"));

    expect(onSelectMany).toHaveBeenCalledWith([]);
  });
});
