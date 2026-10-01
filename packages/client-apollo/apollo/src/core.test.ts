/**
 * The core entry serves apps that do not use React, such as Nuxt apps:
 * loading it must not load React.
 */
describe("@graphql-cascade/apollo/core", () => {
  function loadWithoutReact(path: string): Record<string, unknown> {
    let entry: Record<string, unknown> = {};
    jest.isolateModules(() => {
      jest.doMock("react", () => {
        throw new Error(`${path} loaded react`);
      });
      jest.doMock("@apollo/client/react", () => {
        throw new Error(`${path} loaded @apollo/client/react`);
      });
      try {
        entry = require(path);
      } finally {
        jest.dontMock("react");
        jest.dontMock("@apollo/client/react");
      }
    });
    return entry;
  }

  it("loads without React", () => {
    expect(() => loadWithoutReact("./core")).not.toThrow();
  });

  it("exports everything the main entry does but the React hooks", () => {
    const core = Object.keys(loadWithoutReact("./core")).sort();
    const hooks = Object.keys(require("./hooks"));
    const main = Object.keys(require("./index"))
      .filter((name) => !hooks.includes(name))
      .sort();

    expect(core).toEqual(main);
  });
});
