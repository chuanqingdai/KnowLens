export const organizationName = "";

export function createInsuranceTemplateFormState(template) {
  return {
    title: template.title,
    description: template.description,
    rows: template.rows,
    auxiliaryInfo: template.auxiliaryInfo || "",
    organizationName,
    illustration: template.illustration,
    aspectRatio: template.aspectRatio || "9:16",
    styleName: "",
    stylePrompt: "",
  };
}

export function buildInsurancePosterPrompt(template, category, form = createInsuranceTemplateFormState(template)) {
  const aspectRatio = form.aspectRatio || template.aspectRatio || "9:16";
  const rawStylePrompt = form.stylePrompt
    ? `${form.styleName || "Selected style"}: ${form.stylePrompt}`
    : template.prompt;
  const title = typeof form.title === "string" ? form.title.trim() : "";
  const description = typeof form.description === "string" ? form.description.trim() : "";
  const rows = Array.isArray(form.rows)
    ? form.rows.map((row) => (typeof row === "string" ? row.trim() : "")).filter(Boolean)
    : [];
  const auxiliaryInfo = typeof form.auxiliaryInfo === "string" ? form.auxiliaryInfo.trim() : "";
  const visualLayout = typeof form.illustration === "string" ? form.illustration.trim() : "";
  const resolvedOrganizationName =
    typeof form.organizationName === "string" ? form.organizationName.trim() : organizationName;
  const coreCount = rows.length;
  const visibleCopy = [
    title,
    description,
    ...rows,
    auxiliaryInfo,
    resolvedOrganizationName,
  ].filter(Boolean);
  const copyConstraint = rows.length
    ? `Copy/content rule: Use the provided title, subtitle, and ${coreCount} core information items as the only content source. Image2 may choose the best visual hierarchy, grouping, chart/table/card treatment, and spacing for readability, but must not add unprovided facts, figures, labels, or marketing claims.`
    : "Copy/content rule: Use only the provided title/subtitle/footer text. Do not invent core points, labels, numbers, subtitles, footer text, or explanatory copy.";
  const footerTexts = [auxiliaryInfo, resolvedOrganizationName].filter(Boolean);
  const footerConstraint = footerTexts.length
    ? `Footer rule: If a footer is visually appropriate, show ${footerTexts.map((copy) => `「${copy}」`).join(" and ")} exactly once.`
    : "Footer rule: No auxiliary information or organization name is provided; do not add disclaimer, company, logo, watermark, or placeholder footer text.";
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
  const visualLayoutLine = visualLayout
    ? `Visual guidance: ${visualLayout} Treat this as high-level art direction and reference imagery, not a rigid wireframe.`
    : "";
  const image2LayoutRule =
    "Layout: Trust Image2's native layout ability. Create a polished poster with one clear visual focus, integrated infographic composition, readable hierarchy, natural whitespace, and a strong top-to-bottom scan path. Do not overfit to a mechanical grid if a more editorial layout looks better.";
  const isStoryEducationPoster =
    `${template.primaryCategory || ""} ${template.category || ""} ${template.secondaryCategory || ""} ${visualLayout}`.includes("科普") &&
    /故事|分镜|漫画|情节|角色|场景/.test(visualLayout);
  const storyEducationRule = isStoryEducationPoster
    ? "Story education rule: Present the poster as a coherent illustrated micro-story with one knowledge point only. Use friendly character scenes, a clear problem-to-solution flow, and light infographic support; avoid turning it into a dense legal table or a pile of equal cards."
    : "";

  return [
    "Use case: ads-marketing",
    `Asset type: Chinese insurance marketing poster, ${aspectRatio} layout`,
    `Primary request: Create a polished insurance poster for this scene. Scene category is context only and must not appear as visible text: ${category} / ${template.secondaryCategory}.`,
    `Style/medium: ${rawStylePrompt} Premium commercial insurance poster, cohesive visual system, refined Chinese typography, harmonious palette, soft lighting, clean hierarchy.`,
    visualLayoutLine,
    image2LayoutRule,
    storyEducationRule,
    ...textWhitelistLines,
    copyConstraint,
    footerConstraint,
    `Avoid: ${avoidFieldLabels.length ? `visible field labels such as ${avoidFieldLabels.join("、")}; ` : ""}visible category words such as 分类、一级分类、二级分类、品宣; real insurance company names; unprovided text or numbers inside decorative illustrations, icons, shields, documents, badges, stairs, cards, or backgrounds.`,
    "Quality: high-resolution, elegant, unified, professional, trustworthy Chinese insurance marketing design, crisp readable typography, balanced spacing, no clutter, no watermark, no fake logo, no fabricated numbers or extra copy.",
  ].filter(Boolean).join("\n");
}
