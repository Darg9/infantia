/**
 * jscodeshift codemod
 * Migra clases Tailwind (gray/slate/zinc/neutral, shadows, divide)
 * a tokens del Design System (hp-*)
 */

const BORDER_RE = /^(.*?:)?border-(gray|slate|zinc|neutral)-[0-9]{2,3}$/;
const DIVIDE_RE = /^(.*?:)?divide-(gray|slate|zinc|neutral)-[0-9]{2,3}$/;
const TEXT_RE = /^(.*?:)?text-(gray|slate|zinc|neutral)-(\d{2,3})$/;
const BG_RE = /^(.*?:)?bg-(gray|slate|zinc|neutral)-(\d{2,3})$/;
const SHADOW_RE = /^(.*?:)?shadow-(sm|md|lg)$/;

function processPrefixes(prefixesStr) {
  if (!prefixesStr) return "";
  const parts = prefixesStr.split(':').filter(p => p !== 'dark' && p !== '');
  return parts.length > 0 ? parts.join(':') + ':' : "";
}

function mapTextClass(cls) {
  const m = cls.match(TEXT_RE);
  if (!m) return cls;
  const prefix = processPrefixes(m[1]);
  const level = parseInt(m[3], 10);

  if (level >= 800) return prefix + "text-[var(--hp-text-primary)]";
  if (level >= 600) return prefix + "text-[var(--hp-text-secondary)]";
  if (level >= 400) return prefix + "text-[var(--hp-text-tertiary)]";
  return prefix + "text-[var(--hp-text-muted)]";
}

function mapBgClass(cls) {
  const m = cls.match(BG_RE);
  if (!m) return cls;
  const prefix = processPrefixes(m[1]);
  const level = parseInt(m[3], 10);

  if (level <= 100) return prefix + "bg-[var(--hp-bg-page)]";
  if (level <= 300) return prefix + "bg-[var(--hp-bg-surface)]";
  if (level >= 800) return prefix + "bg-[var(--hp-bg-surface)]";
  return prefix + "bg-[var(--hp-bg-surface)]";
}

function transformClasses(classStr) {
  let classes = classStr.split(/([\s'"`]+)/).filter(Boolean); // split preserving spaces/quotes inside string literals
  
  classes = classes.map((c) => {
    let raw = c.trim();
    if (!raw) return c; // keep whitespaces

    if (BORDER_RE.test(raw)) {
      const m = raw.match(BORDER_RE);
      const prefix = processPrefixes(m[1]);
      return c.replace(raw, prefix + "border-[var(--hp-border-subtle)]");
    }

    if (DIVIDE_RE.test(raw)) {
      const m = raw.match(DIVIDE_RE);
      const prefix = processPrefixes(m[1]);
      return c.replace(raw, prefix + "divide-[var(--hp-border-subtle)]");
    }

    if (TEXT_RE.test(raw)) {
      return c.replace(raw, mapTextClass(raw));
    }

    if (BG_RE.test(raw)) {
      return c.replace(raw, mapBgClass(raw));
    }

    if (SHADOW_RE.test(raw)) {
      const m = raw.match(SHADOW_RE);
      const prefix = processPrefixes(m[1]);
      return c.replace(raw, prefix + "shadow-[var(--hp-shadow-md)]");
    }

    return c;
  });

  return classes.join("");
}

function traverseAndTransform(node, j) {
  if (!node) return;
  if (node.type === "StringLiteral" || node.type === "Literal") {
    if (typeof node.value === "string") {
      node.value = transformClasses(node.value);
    }
  } else if (node.type === "TemplateLiteral") {
    node.quasis.forEach(q => {
      q.value.raw = transformClasses(q.value.raw);
      if (q.value.cooked) q.value.cooked = transformClasses(q.value.cooked);
    });
  } else if (node.type === "JSXExpressionContainer") {
    traverseAndTransform(node.expression, j);
  } else if (node.type === "ConditionalExpression") {
    traverseAndTransform(node.consequent, j);
    traverseAndTransform(node.alternate, j);
  } else if (node.type === "LogicalExpression") {
    traverseAndTransform(node.right, j);
  } else if (node.type === "CallExpression") {
    node.arguments.forEach(arg => traverseAndTransform(arg, j));
  } else if (node.type === "ArrayExpression") {
    node.elements.forEach(el => traverseAndTransform(el, j));
  } else if (node.type === "ObjectExpression") {
    node.properties.forEach(prop => {
      if (prop.key && (prop.key.type === "StringLiteral" || prop.key.type === "Literal")) {
        if (typeof prop.key.value === "string") {
          prop.key.value = transformClasses(prop.key.value);
        }
      }
    });
  }
}

module.exports = function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  // className="..."
  root.find(j.JSXAttribute, { name: { name: "className" } }).forEach((path) => {
    traverseAndTransform(path.node.value, j);
  });

  return root.toSource({ quote: "single" });
};
