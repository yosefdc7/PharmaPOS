import { describe, expect, it } from "vitest";
import { sanitizeString, sanitizeRecord } from "./sanitize";

describe("sanitizeString", () => {
  it("strips HTML tags", () => {
    expect(sanitizeString("<script>alert('xss')</script>")).toBe("alert('xss')");
  });

  it("strips nested HTML tags", () => {
    expect(sanitizeString('<div><b>hello</b></div>')).toBe("hello");
  });

  it("strips on* event handler attributes", () => {
    expect(sanitizeString('img onerror="alert(1)"')).toBe("img");
  });

  it("strips javascript: URIs", () => {
    expect(sanitizeString('href="javascript:alert(1)"')).toBe('href="alert(1)"');
  });

  it("strips vbscript: URIs", () => {
    expect(sanitizeString('action="vbscript:run"')).toBe('action="run"');
  });

  it("passes plain text through unchanged", () => {
    expect(sanitizeString("Hello World")).toBe("Hello World");
  });

  it("trims whitespace", () => {
    expect(sanitizeString("  hello  ")).toBe("hello");
  });

  it("handles empty string", () => {
    expect(sanitizeString("")).toBe("");
  });

  it("handles string that is only HTML tags", () => {
    expect(sanitizeString("<br>")).toBe("");
  });

  it("strips img tag with onerror", () => {
    expect(sanitizeString('<img src=x onerror="alert(1)">')).toBe("");
  });
});

describe("sanitizeRecord", () => {
  it("sanitizes only specified fields", () => {
    const record = {
      id: "1",
      name: "<b>Test</b>",
      phone: "123-456",
      email: '<a href="javascript:void">click</a>'
    };
    const result = sanitizeRecord(record, ["name", "email"]);
    expect(result.name).toBe("Test");
    expect(result.email).toBe("click");
    expect(result.phone).toBe("123-456");
    expect(result.id).toBe("1");
  });

  it("does not modify non-string fields", () => {
    const record = { id: "1", price: 10, active: true };
    const result = sanitizeRecord(record, ["price", "active"] as never[]);
    expect(result.price).toBe(10);
    expect(result.active).toBe(true);
  });

  it("handles undefined specified fields gracefully", () => {
    const record = { id: "1", name: "clean" };
    const result = sanitizeRecord(record, ["name", "missing"] as (keyof typeof record)[]);
    expect(result.name).toBe("clean");
  });

  it("returns a new object without mutating the original", () => {
    const record = { id: "1", name: "<script>bad</script>" };
    const result = sanitizeRecord(record, ["name"]);
    expect(record.name).toBe("<script>bad</script>");
    expect(result.name).toBe("bad");
  });
});
