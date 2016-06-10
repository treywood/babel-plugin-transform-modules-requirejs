import template from "babel-template";

let buildDefine = template(`
  define(MODULE_NAME, [SOURCES], FACTORY);
`);

let buildFactory = template(`
  (function (PARAMS) {
    BODY;
    RETURN;
  })
`);

export default function ({ types: t }) {
  function isValidRequireCall(path) {
    if (!path.isCallExpression()) return false;
    if (!path.get("callee").isIdentifier({ name: "require" })) return false;
    if (path.scope.getBinding("require")) return false;

    let args = path.get("arguments");
    if (args.length !== 1) return false;

    let arg = args[0];
    if (!arg.isStringLiteral()) return false;

    return true;
  }

  function isDefineCall(path) {
    return path.isCallExpression() &&
      path.get("callee").isIdentifier({ name: "define" });
  }

  let amdVisitor = {
    ReferencedIdentifier({ node, scope }) {
      if (node.name === "exports" && !scope.getBinding("exports")) {
        this.hasExports = true;
      }

      if (node.name === "module" && !scope.getBinding("module")) {
        this.hasModule = true;
      }
    },

    CallExpression(path) {
      if (!isValidRequireCall(path)) return;
      this.bareSources.push(path.node.arguments[0]);
      path.remove();
    },

    VariableDeclarator(path) {
      let id = path.get("id");
      if (!id.isIdentifier()) return;

      let init = path.get("init");
      if (!isValidRequireCall(init)) return;

      let source = init.node.arguments[0];
      this.sourceNames[source.value] = true;
      this.sources.push([id.node, source]);

      path.remove();
    },
  };

  let defineHunter = {
    CallExpression(path) {
      if (isDefineCall(path)) {
        this.hasDefine = true;
      }
    }
  };

  return {
    inherits: require("babel-plugin-transform-es2015-modules-commonjs"),

    pre() {
      // source strings
      this.sources = [];
      this.sourceNames = Object.create(null);

      // bare sources
      this.bareSources = [];

      this.hasExports = false;
      this.hasModule = false;
      this.hasDefault = false;
      this.hasDefine = false;
    },

    visitor: {
      Program: {

        enter(path) {
          if (this.ran) return;

          let [top] = path.get("body"), exp;
          if (top.isExpressionStatement() && (exp = top.get("expression"))) {
            if (exp.isCallExpression() && exp.get("callee").isIdentifier({ name: "define" })) {
              this.hasDefine = true;
              return;
            }
          }

          for (let p of path.get("body")) {
            if (p.isExportDefaultDeclaration()) {
              this.hasDefault = true;
            }
          }
        },

        exit(path) {
          if (this.ran || this.hasDefine) return;
          this.ran = true;

          path.traverse(amdVisitor, this);

          let params = this.sources.map((source) => source[0]);
          let sources = this.sources.map((source) => source[1]);

          sources = sources.concat(this.bareSources.filter((str) => {
            return !this.sourceNames[str.value];
          }));

          let moduleName = this.getModuleName();
          if (moduleName) moduleName = t.stringLiteral(moduleName);

          let { node } = path;

          let e = t.VariableDeclarator(
            t.Identifier("exports"),
            t.ObjectExpression([])
          );
          let v = t.VariableDeclaration("var", [e]);

          node.body.unshift(v);

          let ret;
          if (this.hasDefault) {
            ret = t.MemberExpression(t.Identifier("exports"), t.Identifier("default"));
          } else {
            ret = t.Identifier("exports");
          }

          let factory = buildFactory({
            PARAMS: params,
            BODY: node.body,
            RETURN: t.ReturnStatement(ret)
          });
          factory.expression.body.directives = node.directives;
          node.directives = [];

          node.body = [buildDefine({
            MODULE_NAME: moduleName,
            SOURCES: sources,
            FACTORY: factory
          })];
        }
      }
    }
  };
}
