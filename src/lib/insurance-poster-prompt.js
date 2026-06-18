export const organizationName = "使用KnowLens.ai绘制";

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
  const visibleCopy = [
    form.title,
    form.description,
    ...form.rows,
    form.auxiliaryInfo,
    form.organizationName || organizationName,
  ];

  return [
    "Use case: ads-marketing",
    `Asset type: Chinese insurance marketing poster, ${aspectRatio} layout`,
    `Primary request: Create a polished insurance poster for this scene. Scene category is context only and must not appear as visible text: ${category} / ${template.secondaryCategory}.`,
    `Style/medium: ${stylePrompt} Premium commercial insurance poster, cohesive visual system, refined Chinese typography, harmonious palette, soft lighting, clean hierarchy.`,
    `Composition/framing: Title first, subtitle second, core points as separate readable lines, footer small text. Use a stable mobile poster layout with clear negative space.`,
    `Subject/illustration: ${form.illustration}`,
    "Text (verbatim whitelist): Only render the following visible Chinese text, exactly as written. Do not add, delete, rewrite, translate, label, number, or invent visible text:",
    ...visibleCopy.map((copy) => `「${copy}」`),
    "Layout constraints: The core content area contains exactly the core point lines from the whitelist. Do not show a fixed count, do not number the points, and do not mix subtitle, auxiliary information, or organization name into the core points.",
    `Footer constraints: The bottom footer must show both footer texts exactly once: 「${form.auxiliaryInfo}」 and 「${form.organizationName || organizationName}」. If space is tight, reduce footer font size or place them on two lines; never omit the organization name. Do not attach icons, badges, buttons, labels, or card containers to footer text.`,
    "Avoid: visible field labels such as 标题、副标题、核心要点、辅助信息、机构名称; visible category words such as 分类、一级分类、二级分类、品宣; any text or numbers inside illustrations, icons, shields, documents, badges, stairs, cards, or backgrounds.",
    "Quality: high-resolution, elegant, unified, professional, trustworthy Chinese insurance marketing design, crisp readable typography, balanced spacing, no clutter, no watermark, no fake logo, no fabricated numbers or extra copy.",
  ].join("\n");
}
