import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const GiB = 1024 ** 3;
const nodes = [
  {
    uuid: "tokyo",
    name: "Tokyo · 东京节点",
    region: "JP",
    group: "亚太",
    os: "Ubuntu 24.04",
    cpu_name: "AMD EPYC 7B13",
    cpu_cores: 4,
    arch: "x86_64",
    mem_total: 4 * GiB,
    disk_total: 80 * GiB,
  },
  {
    uuid: "hongkong",
    name: "Hong Kong · 香港",
    region: "HK",
    group: "亚太",
    os: "Debian 12",
    cpu_name: "Intel Xeon",
    cpu_cores: 2,
    arch: "x86_64",
    mem_total: 2 * GiB,
    disk_total: 40 * GiB,
  },
  {
    uuid: "frankfurt",
    name: "Frankfurt · 法兰克福",
    region: "DE",
    group: "欧洲",
    os: "Ubuntu 24.04",
    cpu_cores: 2,
    mem_total: 2 * GiB,
    disk_total: 40 * GiB,
  },
];
const records = Array.from({ length: 24 }, (_, i) => ({
  time: new Date(Date.UTC(2026, 10, 2, 8, i * 10)).toISOString(),
  cpu: 20 + (i % 7) * 4,
  ram: GiB + i * 10000,
  ram_total: 4 * GiB,
  net_in: 20000 + i * 1000,
  net_out: 10000 + i * 500,
}));
async function setup(page: Page, mode = "normal") {
  let authenticated = false;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = {};
    if (path === "/api/public")
      data = {
        sitename: "Komari",
        theme_settings: { refresh_seconds: 2 },
        oauth_enable: true,
      };
    else if (path === "/api/me") {
      await route.fulfill({ json: { logged_in: authenticated } });
      return;
    } else if (path === "/api/login") {
      const body = route.request().postDataJSON();
      expect(body.username).toBe("tester");
      expect(body.password).toBe("test-password");
      authenticated = true;
    } else if (path === "/api/nodes") {
      if (mode === "private" && !authenticated) {
        await route.fulfill({
          status: 401,
          json: {
            status: "error",
            message: "Private site is enabled, please login first.",
          },
        });
        return;
      }
      if (mode === "error") {
        await route.fulfill({
          status: 500,
          json: { status: "error", message: "Test unavailable" },
        });
        return;
      }
      data = mode === "empty" ? [] : nodes;
    } else if (path === "/api/records/load") data = { records };
    else if (path === "/api/records/ping")
      data = {
        records: records.map((r, i) => ({
          time: r.time,
          task_id: 1,
          value: i === 4 ? -1 : 30 + (i % 5),
        })),
      };
    else if (path === "/api/task/ping") data = [{ id: 1, name: "中国电信" }];
    await route.fulfill({ json: { status: "success", data } });
  });
  await page.routeWebSocket("**/api/clients", (ws) => {
    ws.onMessage(() => {
      if (mode === "disconnect") {
        ws.close();
        return;
      }
      ws.send(
        JSON.stringify({
          status: "success",
          data: {
            online: ["tokyo", "hongkong"],
            data: {
              tokyo: {
                cpu: { usage: 24 },
                ram: { used: GiB, total: 4 * GiB },
                disk: { used: 16 * GiB, total: 80 * GiB },
                network: {
                  up: 12288,
                  down: 32768,
                  totalUp: GiB,
                  totalDown: 2 * GiB,
                },
                uptime: 172800,
                load: { load1: 0.4 },
              },
              hongkong: {
                cpu: { usage: 8 },
                ram: { used: GiB, total: 2 * GiB },
                disk: { used: 8 * GiB, total: 40 * GiB },
                network: { up: 1024, down: 2048 },
                uptime: 86400,
              },
            },
          },
        }),
      );
    });
  });
  await page.goto("/themes/MD3/dist/");
  await expect(
    page.getByRole("heading", {
      name:
        mode === "error" || mode === "private"
          ? "暂时无法查看节点"
          : mode === "empty"
            ? "暂无节点"
            : "服务器概览",
      exact: true,
    }),
  ).toBeVisible();
}
test("desktop and mobile: filters, details, theme persistence, no overflow or runtime errors", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page);
  await expect(page.locator(".node-card")).toHaveCount(3);
  await expect(page.locator(".online")).toHaveCount(2);
  await page.screenshot({
    path: info.outputPath("desktop-light.png"),
    fullPage: true,
  });
  const search = page
    .locator("md-outlined-text-field.search")
    .getByRole("searchbox");
  await search.fill("Tokyo");
  await expect(page.locator(".node-card")).toHaveCount(1);
  await search.fill("");
  await page.getByRole("button", { name: "离线", exact: true }).click();
  await expect(page.locator(".node-card")).toHaveCount(1);
  await expect(page.locator(".node-card h3")).toHaveText(
    "Frankfurt · 法兰克福",
  );
  await page.getByRole("button", { name: "全部", exact: true }).click();
  await page
    .getByRole("button", { name: "查看 Tokyo · 东京节点 详情" })
    .click();
  await expect(page.locator("#load-chart")).toBeVisible();
  await expect(page.locator("#ping-chart")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("desktop-detail.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "返回概览" }).click();
  await page.getByRole("button", { name: "外观", exact: true }).click();
  await page.getByRole("button", { name: "深色", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
  await page.getByRole("button", { name: "概览", exact: true }).click();
  await page.screenshot({
    path: info.outputPath("desktop-dark.png"),
    fullPage: true,
  });
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBeTruthy();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: info.outputPath("mobile-dark.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
  expect(errors).toEqual([]);
});
test("WCAG light and dark", async ({ page }, info) => {
  await setup(page);
  for (const mode of ["light", "dark"]) {
    await page.setViewportSize({width:mode==="light"?1280:390,height:900});
    await page.getByRole("button", { name: "外观", exact: true }).click();
    await page
      .getByRole("button", {
        name: mode === "light" ? "浅色" : "深色",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "概览", exact: true }).click();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    await info.attach(`axe-${mode}`, {
      body: JSON.stringify(results),
      contentType: "application/json",
    });
    expect(results.violations).toEqual([]);
  }
});
test("private site login submits Material text field form values", async ({
  page,
}) => {
  await setup(page, "private");
  await page.getByRole("button", { name: "登录", exact: true }).last().click();
  const dialog = page.locator("md-dialog");
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("textbox", { name: "用户名", exact: true })
    .fill("tester");
  await dialog
    .getByRole("textbox", { name: "密码", exact: true })
    .fill("test-password");
  await dialog.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.locator(".node-card")).toHaveCount(3);
  await expect(dialog).not.toBeVisible();
});
for (const mode of ["empty", "error", "disconnect"])
  test(`${mode} state is visible and does not show false online`, async ({
    page,
  }) => {
    await setup(page, mode);
    if (mode === "disconnect") {
      await expect(
        page.getByText("实时连接尚未就绪", { exact: false }),
      ).toBeVisible();
      await expect(page.locator(".online")).toHaveCount(0);
    } else if (mode === "empty")
      await expect(page.getByText("暂无节点", { exact: true })).toBeVisible();
    else
      await expect(page.getByRole("alert")).toContainText("Test unavailable");
  });
