import { expect, test } from "@playwright/test";
import { api, createTestProject, hasCreds, login, seccion, type TestProject } from "./helpers";

test.skip(!hasCreds, "Definí EIA_EMAIL y EIA_PASS para correr las pruebas E2E");

test("el login entra directo a Proyectos, sin pasar por 'crear organización'", async ({ page }) => {
  const rutas: string[] = [];
  page.on("framenavigated", (f) => { if (f === page.mainFrame()) rutas.push(new URL(f.url()).pathname); });
  await login(page);
  expect(rutas).not.toContain("/onboarding/");
  await expect(page.getByRole("heading", { name: "Proyectos" })).toBeVisible();
});

test.describe("proyecto de prueba", () => {
  let p: TestProject;
  test.beforeAll(async () => { p = await createTestProject(await api()); });
  test.afterAll(async () => { await p?.cleanup(); });

  test("la portada guía al siguiente paso y no se corta a 360 px", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(seccion(p.id, "resumen"));
    await expect(page.getByText("Siguiente paso")).toBeVisible();
    const desborda = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(desborda).toBe(false);
  });

  test("en el celular la lista de proyectos son tarjetas y no desborda a 360 px", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/proyectos/");
    await expect(page.getByRole("list", { name: "Proyectos" }).getByRole("link", { name: /ZZ e2e proyecto/ }).first()).toBeVisible();
    const desborda = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(desborda).toBe(false);
  });

  test("relevamiento a 360 px: la ficha muestra lo pendiente y el waypoint nuevo queda a la vista", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(seccion(p.id, "relevamiento"));
    await page.getByRole("button", { name: "Nueva ficha" }).click();
    await expect(page.getByRole("heading", { name: /Ficha N°/ })).toBeVisible();
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Agregar waypoint" }).click();
    await expect(page.getByRole("button", { name: /^Quitar waypoint/ })).toHaveCount(3);
    await expect(page.getByRole("button", { name: /^Quitar waypoint/ }).last()).toBeInViewport();
    const desborda = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(desborda).toBe(false);
  });

  test("una celda de la matriz se completa solo con clics y da −21 (valor real del Excel)", async ({ page }) => {
    await login(page);
    await page.goto(seccion(p.id, "impactos"));
    await page.getByRole("button", { name: /Calidad perceptible del aire, Traslado de equipos y materiales/ }).click();
    const valores: Record<string, string> = { Intensidad: "1", Extensión: "2", Momento: "4", Persistencia: "1", Reversibilidad: "1", Sinergia: "1", Acumulación: "1", Efecto: "4", Periodicidad: "1", Recuperabilidad: "1" };
    for (const [nombre, v] of Object.entries(valores)) await page.getByLabel(new RegExp(`^${nombre} \\(`)).selectOption({ label: v });
    await expect(page.getByRole("status")).toContainText("−21");
    await expect(page.getByRole("status")).toContainText("−1,05");   // ponderada por UIP 50
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    // vuelve a leerse desde la base: la importancia y la categoría las calculó el trigger
    await expect(page.getByRole("button", { name: /Calidad perceptible del aire, Traslado de equipos y materiales: −21 Bajo/ })).toBeVisible();
  });

  test("el Control marca lo que falta y lleva a corregirlo", async ({ page }) => {
    await login(page);
    await page.goto(seccion(p.id, "control"));
    await expect(page.getByText("Faltan datos obligatorios del proyecto")).toBeVisible();
    await page.getByRole("button", { name: /Ir a Datos/ }).first().click();
    await expect(page).toHaveURL(/s=datos/);
  });

  test("Declaración y PGA usan los textos del catálogo con el nombre corto del proyecto", async ({ page }) => {
    await login(page);
    await page.goto(seccion(p.id, "declaracion"));
    await expect(page.locator("textarea").first()).toBeVisible();
    const textos = await page.$$eval("textarea", (els) => els.map((e) => (e as HTMLTextAreaElement).value).join("\n"));
    expect(textos).not.toContain("{pad}");
    expect(textos).toContain("PAD 58");
  });
});
