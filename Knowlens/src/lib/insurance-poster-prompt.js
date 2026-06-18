export const organizationName = "";

export function createInsuranceTemplateFormState(template) {
  return {
    title: template.title,
    description: template.description,
    rows: template.rows,
    auxiliaryInfo: template.auxiliaryInfo,
    organizationName,
    illustration: template.illustration,
    aspectRatio: template.aspectRatio || "9:16",
    styleName: "",
    stylePrompt: "",
  };
}

export function buildInsurancePosterPrompt(template, category, form = createInsuranceTemplateFormState(template)) {
  const aspectRatio = form.aspectRatio || template.aspectRatio || "9:16";
  const stylePrompt = form.stylePrompt
    ? `${form.styleName || "Selected style"}: ${form.stylePrompt}`
    : template.prompt;
  const title = typeof form.title === "string" ? form.title.trim() : "";
  const description = typeof form.description === "string" ? form.description.trim() : "";
  const rows = Array.isArray(form.rows)
    ? form.rows.map((row) => (typeof row === "string" ? row.trim() : "")).filter(Boolean)
    : [];
  const auxiliaryInfo = typeof form.auxiliaryInfo === "string" ? form.auxiliaryInfo.trim() : "";
  const illustration = typeof form.illustration === "string" ? form.illustration.trim() : "";
  const resolvedOrganizationName =
    typeof form.organizationName === "string" ? form.organizationName.trim() : organizationName;
  const visibleCopy = [
    title,
    description,
    ...rows,
    auxiliaryInfo,
    resolvedOrganizationName,
  ].filter(Boolean);
  const compositionParts = [
    title ? "place the title as the strongest visual text" : "",
    description ? "place the subtitle below or near the title" : "",
    rows.length ? "present core information as readable lines, icon cards, or structured modules" : "",
    auxiliaryInfo || resolvedOrganizationName ? "keep footer text small and restrained" : "",
  ].filter(Boolean);
  const layoutAvoidMixing = [
    description ? "subtitle" : "",
    auxiliaryInfo ? "auxiliary information" : "",
    resolvedOrganizationName ? "organization name" : "",
  ].filter(Boolean);
  const layoutConstraint = rows.length
    ? `Layout constraints: The core content area contains exactly the core information from the whitelist. Do not invent a fixed count or add unprovided items${layoutAvoidMixing.length ? `, and do not mix ${layoutAvoidMixing.join(", ")} into the core content area` : ""}.`
    : "Layout constraints: Use only the provided whitelist text. Do not invent core points, labels, numbers, subtitles, footer text, or explanatory copy.";
  const footerTexts = [auxiliaryInfo, resolvedOrganizationName].filter(Boolean);
  const footerConstraint = footerTexts.length
    ? `Footer constraints: The bottom footer must show ${footerTexts.map((copy) => `「${copy}」`).join(" and ")} exactly once. If space is tight, reduce footer font size or place footer text on two lines. Do not replace footer text with any insurance company, brand, logo, watermark, license name, or placeholder text. Do not attach icons, badges, buttons, labels, or card containers to footer text.`
    : "Footer constraints: Do not render footer text, company, brand, logo, watermark, license name, or placeholder text.";
  const avoidFieldLabels = [
    title ? "标题" : "",
    description ? "副标题" : "",
    rows.length ? "核心要点" : "",
    auxiliaryInfo ? "辅助信息" : "",
    resolvedOrganizationName ? "机构名称" : "",
  ].filter(Boolean);
  const textWhitelistLines = visibleCopy.length
    ? [
        "Text (verbatim whitelist): Only render the following visible Chinese text, exactly as written. Do not add, delete, rewrite, translate, label, number, or invent visible text:",
        ...visibleCopy.map((copy) => `「${copy}」`),
      ]
    : ["Text: No visible text is provided. Do not render any text, label, number, company name, logo text, watermark, or placeholder copy."];
  const subjectLine = illustration ? `Subject/illustration: ${illustration}` : "";

  return [
    "Use case: ads-marketing",
    `Asset type: Chinese insurance marketing poster, ${aspectRatio} layout`,
    `Primary request: Create a polished insurance poster for this scene. Scene category is context only and must not appear as visible text: ${category} / ${template.secondaryCategory}.`,
    `Style/medium: ${stylePrompt} Premium commercial insurance poster, cohesive visual system, refined Chinese typography, harmonious palette, soft lighting, clean hierarchy.`,
    `Composition/framing: ${compositionParts.length ? `${compositionParts.join("; ")}. ` : ""}Use a stable mobile poster layout with clear negative space.`,
    subjectLine,
    ...textWhitelistLines,
    layoutConstraint,
    footerConstraint,
    `Avoid: ${avoidFieldLabels.length ? `visible field labels such as ${avoidFieldLabels.join("、")}; ` : ""}visible category words such as 分类、一级分类、二级分类、品宣; real insurance company names; any text or numbers inside illustrations, icons, shields, documents, badges, stairs, cards, or backgrounds.`,
    "Quality: high-resolution, elegant, unified, professional, trustworthy Chinese insurance marketing design, crisp readable typography, balanced spacing, no clutter, no watermark, no fake logo, no fabricated numbers or extra copy.",
  ].filter(Boolean).join("\n");
}
