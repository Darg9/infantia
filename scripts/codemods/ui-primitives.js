export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  let hasButton = false;
  let hasInput = false;

  /**
   * <button> → <Button>
   */
  root.find(j.JSXOpeningElement, { name: { name: "button" } }).forEach((path) => {
    path.node.name.name = "Button";
    hasButton = true;
  });

  root.find(j.JSXClosingElement, { name: { name: "button" } }).forEach((path) => {
    path.node.name.name = "Button";
  });

  /**
   * <input> → <Input>
   */
  root.find(j.JSXOpeningElement, { name: { name: "input" } }).forEach((path) => {
    path.node.name.name = "Input";
    hasInput = true;
  });

  /**
   * Inyectar imports si faltan
   */
  const importDecl = root.find(j.ImportDeclaration);

  if (hasButton) {
    root.get().node.program.body.unshift(
      j.importDeclaration(
        [j.importSpecifier(j.identifier("Button"))],
        j.literal("@/components/ui/button")
      )
    );
  }

  if (hasInput) {
    root.get().node.program.body.unshift(
      j.importDeclaration(
        [j.importSpecifier(j.identifier("Input"))],
        j.literal("@/components/ui/input")
      )
    );
  }

  return root.toSource();
}
