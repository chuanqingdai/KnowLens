import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const siteUrl = "https://knowlens.ai";
const categorySlug = "biology";
const categoryName = "Biology";
const categoryKeyword = "Biology Infographic Templates";
const generatorKeywords = [
  "Biology Infographic Generator",
  "Science Infographic Generator",
  "Educational Infographic Maker",
  "AI Infographic Generator",
];

const previewImages = [
  { path: "/picture/biology-infographic.jpg", width: 1003, height: 565 },
  { path: "/en-picture/biology/3e6947fd-b03e-4dc7-8551-b22bfeefa148.png", width: 1086, height: 1448 },
  { path: "/en-picture/biology/09222a94-ab66-4ba1-8b95-f28ac121f083.png", width: 941, height: 1672 },
  { path: "/en-picture/biology/74380d3a-9a1b-44a2-998a-7c3482175ff4.png", width: 941, height: 1672 },
  { path: "/en-picture/biology/d64c1b7c-e35d-4ff9-8753-03a3df83eded.png", width: 941, height: 1672 },
  { path: "/en-picture/biology/e89085e6-c6c5-44f3-a92b-08fd81742821.png", width: 1122, height: 1402 },
] as const;

const topicTitles = [
  "Cell Structure Infographic",
  "Plant Cell vs Animal Cell Infographic",
  "DNA Structure Infographic",
  "Photosynthesis Process Infographic",
  "Human Digestive System Infographic",
  "Human Respiratory System Infographic",
  "Blood Circulation Infographic",
  "Nervous System Infographic",
  "Food Chain Infographic",
  "Ecosystem Energy Flow Infographic",
  "Mitosis Cell Division Infographic",
  "Meiosis Process Infographic",
  "Protein Synthesis Infographic",
  "Enzyme Function Infographic",
  "Immune System Infographic",
  "Bacteria vs Virus Infographic",
  "Human Skeleton Infographic",
  "Muscle System Infographic",
  "Brain Regions Infographic",
  "Plant Life Cycle Infographic",
  "Butterfly Life Cycle Infographic",
  "Frog Life Cycle Infographic",
  "Human Eye Anatomy Infographic",
  "Human Ear Anatomy Infographic",
  "Genetics Basics Infographic",
  "Natural Selection Infographic",
  "Biodiversity Infographic",
  "Human Body Systems Infographic",
  "Microscope Parts Infographic",
  "Levels of Biological Organization Infographic",
  "Prokaryotic vs Eukaryotic Cells Infographic",
  "Cell Organelles Infographic",
  "Cell Membrane Structure Infographic",
  "Osmosis and Diffusion Infographic",
  "Active Transport vs Passive Transport Infographic",
  "Cell Cycle Infographic",
  "Stem Cells Infographic",
  "Cell Specialization Infographic",
  "Apoptosis Programmed Cell Death Infographic",
  "Cancer Cell Basics Infographic",
  "DNA Replication Infographic",
  "RNA vs DNA Infographic",
  "Transcription and Translation Infographic",
  "Genes and Chromosomes Infographic",
  "Punnett Square Infographic",
  "Dominant vs Recessive Traits Infographic",
  "Genotype vs Phenotype Infographic",
  "Mutation Types Infographic",
  "Genetic Variation Infographic",
  "Heredity and Inheritance Infographic",
  "Epigenetics Basics Infographic",
  "Human Genome Infographic",
  "Genetic Testing Infographic",
  "CRISPR Gene Editing Infographic",
  "Gene Therapy Infographic",
  "Personalized Medicine Genetics Infographic",
  "Single-Cell Genomics Infographic",
  "Human Heart Anatomy Infographic",
  "Endocrine System Infographic",
  "Lymphatic System Infographic",
  "Skin Layers Infographic",
  "Homeostasis Infographic",
  "Body Temperature Regulation Infographic",
  "Hormones and Feedback Loops Infographic",
  "Human Reproductive System Overview Infographic",
  "Pregnancy Development Stages Infographic",
  "Enzyme Lock and Key Model Infographic",
  "Cellular Respiration Infographic",
  "ATP Energy Cycle Infographic",
  "Chloroplast Structure Infographic",
  "Mitochondria Function Infographic",
  "Carbohydrates Proteins and Fats Infographic",
  "Amino Acids and Proteins Infographic",
  "pH and Enzyme Activity Infographic",
  "Food Web Infographic",
  "Energy Pyramid Infographic",
  "Carbon Cycle Infographic",
  "Nitrogen Cycle Infographic",
  "Water Cycle and Life Infographic",
  "Habitat vs Ecosystem Infographic",
  "Invasive Species Infographic",
  "Pollination Process Infographic",
  "Bee Pollination Infographic",
  "Coral Reef Ecosystem Infographic",
  "Rainforest Layers Infographic",
  "Ocean Food Chain Infographic",
  "Evolution Basics Infographic",
  "Adaptation in Animals Infographic",
  "Speciation Infographic",
  "Fossil Evidence for Evolution Infographic",
  "Bacterial Cell Structure Infographic",
  "Virus Structure Infographic",
  "How Viruses Replicate Infographic",
  "Microbiome Infographic",
  "Gut Microbiome Infographic",
  "Antibiotics vs Antivirals Infographic",
  "Vaccine Basics Infographic",
  "mRNA Vaccine Basics Infographic",
  "Antibodies Infographic",
  "White Blood Cells Infographic",
] as const;

export type BiologyInfographicTemplate = ReturnType<typeof buildTemplate>;

type GeneratedTemplateImage = {
  generationProvider: string;
  generationStatus: "success" | "failed" | "skipped";
  previewImageUrl: string;
  storageKey: string;
  imageFilename: string;
  imageFormat: "webp" | "png" | "jpg";
  imageMimeType: string;
  imageWidth: number;
  imageHeight: number;
  imageSizeBytes?: number;
  updatedAt: string;
};

type GeneratedTemplateManifest = {
  templates?: Record<string, GeneratedTemplateImage>;
};

function readGeneratedTemplateManifest() {
  const manifestPath = path.join(process.cwd(), "src/lib/biology-infographic-generated-images.json");
  if (!existsSync(manifestPath)) {
    return {} as Record<string, GeneratedTemplateImage>;
  }
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as GeneratedTemplateManifest;
    return parsed.templates || {};
  } catch {
    return {} as Record<string, GeneratedTemplateImage>;
  }
}

function slugify(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function topicName(title: string) {
  return title.replace(/\s+Infographic$/i, "").trim();
}

function topicKind(topic: string) {
  if (/\bvs\b/i.test(topic)) return "comparison";
  if (/process|replication|synthesis|translation|mitosis|meiosis|cycle|respiration|photosynthesis|pollination|replicate|regulation|feedback|development/i.test(topic)) return "process";
  if (/structure|anatomy|parts|layers|regions|organelles|membrane|skeleton|chloroplast|mitochondria|virus|bacterial cell/i.test(topic)) return "structure";
  if (/systems|system|web|ecosystem|microbiome|circulation|immune|lymphatic|endocrine|network/i.test(topic)) return "system";
  if (/pyramid|food chain/i.test(topic)) return "hierarchy";
  return "concept";
}

function styleName(topic: string) {
  if (/human|heart|brain|skeleton|muscle|eye|ear|immune|lymphatic|skin|hormone|pregnancy|vaccine|antibodies|blood|pathogen/i.test(topic)) return "Medical Science Infographic Style";
  if (/crispr|genetic testing|genomics|personalized|gene therapy/i.test(topic)) return "Dark Premium Tech Style";
  if (/food|ecosystem|biodiversity|habitat|species|pollination|coral|rainforest|evolution|adaptation|fossil|life cycle|butterfly|frog/i.test(topic)) return "Premium Editorial Infographic Style";
  if (/microscope|basics|punnett/i.test(topic)) return "Sketchnote Knowledge Style";
  return "Clean Educational Infographic Style";
}

function stylePrompt(style: string) {
  const prompts: Record<string, string> = {
    "Medical Science Infographic Style": "clean medical science infographic style, white background, precise diagrams, soft clinical colors, readable callouts, accurate educational anatomy",
    "Clean Educational Infographic Style": "clean educational infographic style, crisp vector-like diagrams, organized sections, friendly science colors, large readable English terms",
    "Hand-drawn Explainer Style": "hand-drawn explainer style, warm classroom feel, simple icons, sketched arrows, friendly learning notes, uncluttered composition",
    "Sketchnote Knowledge Style": "sketchnote knowledge style, clear marker-like terms, simple science doodles, boxed sections, memorable study-guide layout",
    "Premium Editorial Infographic Style": "premium editorial infographic style, polished layout, balanced imagery, rich but restrained colors, magazine-quality visual hierarchy",
    "Data Business Editorial Style": "data business editorial style, clean panels, modern charts, structured captions, professional science communication look",
    "Dark Premium Tech Style": "dark premium tech style, high-contrast biology diagrams, subtle neon accents, precise terms, modern genomics visual language",
  };
  return prompts[style] || prompts["Clean Educational Infographic Style"];
}

function knowledgePoints(topic: string, kind: string) {
  if (kind === "comparison") return ["main similarities", "key differences", "structure or function", "real biology examples", "student takeaway"];
  if (kind === "process") return ["starting point", "major steps", "key molecules or structures", "direction of flow", "final result"];
  if (kind === "structure") return ["main parts", "terms and callouts", "how each part functions", "spatial relationships", "learning summary"];
  if (kind === "system") return ["connected components", "how parts interact", "flow of information or energy", "system balance", "main takeaway"];
  if (kind === "hierarchy") return ["levels", "direction of energy or scale", "examples at each level", "relationship between layers", "summary rule"];
  return ["core definition", "key components", "how it works", "why it matters", "beginner-friendly takeaway"];
}

function visualPrompt(topic: string, kind: string, aspectRatio: string) {
  const base = `Design the image as a ${aspectRatio} educational biology infographic about ${topic}. Put a clear title at the top, use English only, keep text minimal and readable, and make the layout mobile-readable.`;
  if (kind === "comparison") return `${base} Use a left-right comparison layout with two named subject panels, a shared middle or bottom differences area, checkmark icons, short comparison rows, and simple diagrams that avoid mixing up the two biology concepts.`;
  if (kind === "process") return `${base} Use a numbered arrow flow with 4-6 steps, one small diagram or icon per step, clear start and end points, short stage names, and a strong visual path that explains the process without dense paragraphs.`;
  if (kind === "structure") return `${base} Use a large central structure diagram with accurate simplified anatomy or cell parts, callout lines, 4-6 major biology terms, small explanation cards around the main visual, and no misleading structures.`;
  if (kind === "system") return `${base} Use a central system or network diagram with connected components, arrows showing relationships, grouped modules, concise terms, and a clear explanation of how the parts work together.`;
  if (kind === "hierarchy") return `${base} Use a pyramid, ladder, or tiered hierarchy with icons for each level, clear ordering from lower to higher levels, short terms, and a visual summary of the relationship between layers.`;
  return `${base} Use a central concept diagram with 3-5 organized sections, simple biology icons, arrows or connectors where useful, concise terms, and a clear hierarchy from main idea to supporting facts.`;
}

const imageQualityPrompt = "Create a professional knowledge infographic with clear information hierarchy, minimal and accurate English text, scientifically correct visual elements, precise diagram structures, no spelling mistakes, no distorted or misleading illustrations, and a clean editorial infographic layout that makes the key concepts easy to understand at a glance.";

function cleanImagePromptText(value: string) {
  return value
    .replace(/\bclearly labeled\b/gi, "clearly identified")
    .replace(/\blabeled\b/gi, "named")
    .replace(/\bnumbered labels?\b/gi, "numbered stage names")
    .replace(/\bcallout labels?\b/gi, "callout terms")
    .replace(/\blabels?\b/gi, "biology terms")
    .replace(/\bLabel\s*\d+\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function toVisibleTerm(point: string) {
  return point
    .replace(/\s+(controls|supports|stores|helps?|are|is|can|carry|carries|convert|converts|allow|allows|enter|enters|leave|leaves|move|moves|produce|produces|protect|protects|work|works|begin|begins|contain|contains|include|includes|provide|provides|detect|detects|send|sends|return|returns|reduce|reduced|form|forms|use|uses|show|shows|explain|explains)\b.*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 42) || point.slice(0, 42);
}

const customTemplateDetails: Record<string, { coreConcept: string; knowledgePoints: string[]; visualPrompt: string }> = {
  "Cell Structure Infographic": {
    coreConcept: "Explain the main parts of a typical cell and their basic roles.",
    knowledgePoints: ["Cell membrane controls what enters and leaves the cell", "Cytoplasm supports internal cell processes", "Nucleus stores genetic information", "Mitochondria help release usable energy", "Ribosomes help build proteins"],
    visualPrompt: "Create a large central cutaway diagram of a typical animal cell. Show a rounded cell membrane boundary, soft cytoplasm filling the inside, a clearly labeled nucleus near the center, bean-shaped mitochondria, and small ribosome dots. Use callout lines from each structure to short labels around the cell. Arrange the infographic with a large title at the top, the cell diagram in the center, and five compact explanation cards around it. Avoid plant-only structures such as chloroplasts or a cell wall.",
  },
  "Plant Cell vs Animal Cell Infographic": {
    coreConcept: "Compare the shared and different structures of plant and animal cells.",
    knowledgePoints: ["Both cell types have a nucleus, cytoplasm, mitochondria, and cell membrane", "Plant cells have a cell wall for support", "Plant cells often contain chloroplasts for photosynthesis", "Plant cells usually have a large central vacuole", "Animal cells do not have cell walls or chloroplasts"],
    visualPrompt: "Create a side-by-side comparison infographic. Put a rectangular plant cell on the left and a rounder animal cell on the right. Add section headers Plant Cell and Animal Cell. Show plant structures such as cell wall, chloroplasts, large central vacuole, nucleus, mitochondria, and membrane. Show animal structures such as nucleus, mitochondria, cytoplasm, ribosomes, and membrane. Add a middle strip labeled Shared Parts with nucleus, cytoplasm, mitochondria, and cell membrane. Use checkmarks and balanced spacing.",
  },
  "DNA Structure Infographic": {
    coreConcept: "Explain the basic structure of DNA and how it stores genetic information.",
    knowledgePoints: ["DNA has a double helix structure", "Nucleotides are the building blocks of DNA", "Bases pair in a specific way", "DNA carries instructions for inherited traits", "Genes are segments of DNA"],
    visualPrompt: "Create a central vertical DNA double helix as the main visual. Make the two sugar-phosphate backbones clear and show colored base pairs connecting across the helix. Add concise labels for double helix, nucleotide, base pair, sugar-phosphate backbone, and gene segment. Include a zoom-in callout showing one nucleotide made of sugar, phosphate, and base. Use a clean scientific layout with title at the top and short side cards. Do not include fake genetic code strings.",
  },
  "Photosynthesis Process Infographic": {
    coreConcept: "Explain how plants use light energy to make food.",
    knowledgePoints: ["Plants take in carbon dioxide from the air", "Roots absorb water from the soil", "Chloroplasts capture sunlight", "Glucose is produced as food for the plant", "Oxygen is released as a byproduct"],
    visualPrompt: "Create a process infographic centered on a green plant. Use arrows showing sunlight entering leaves, carbon dioxide entering from air, water moving up from roots, glucose produced inside the leaf, and oxygen leaving the leaf. Add a chloroplast zoom-in bubble inside one leaf. Use short labels: Sunlight, CO2, Water, Chloroplasts, Glucose, Oxygen. For 16:9 composition, make a horizontal flow from inputs on the left to outputs on the right.",
  },
  "Human Digestive System Infographic": {
    coreConcept: "Explain how food moves through the digestive system and becomes nutrients.",
    knowledgePoints: ["Digestion begins in the mouth", "The esophagus moves food to the stomach", "The stomach helps break food down", "The small intestine absorbs nutrients", "The large intestine absorbs water and forms waste"],
    visualPrompt: "Create a clear front-view human torso diagram showing the digestive tract. Highlight the path of food with one continuous arrow from mouth to esophagus, stomach, small intestine, large intestine, and waste exit. Add numbered labels for each stage. Put a large title at the top and a Food Path vertical sequence beside the torso. Keep anatomy simplified but recognizable, with no treatment advice or excessive anatomical detail.",
  },
  "Human Respiratory System Infographic": {
    coreConcept: "Explain how the respiratory system moves oxygen into the body and carbon dioxide out.",
    knowledgePoints: ["Air enters through the nose or mouth", "The trachea carries air toward the lungs", "Bronchi branch into each lung", "Alveoli allow gas exchange", "Oxygen enters the blood and carbon dioxide leaves it"],
    visualPrompt: "Create a vertical infographic with a simplified upper body and lungs as the central diagram. Show air entering through nose and mouth, moving down the trachea, splitting into bronchi, and reaching alveoli. Include a zoom-in bubble of alveoli with arrows showing oxygen entering blood and carbon dioxide leaving blood. Use labels Nose/Mouth, Trachea, Bronchi, Lungs, Alveoli, Gas Exchange. Keep labels large and readable.",
  },
  "Blood Circulation Infographic": {
    coreConcept: "Explain the basic path of blood through the heart, lungs, and body.",
    knowledgePoints: ["The heart pumps blood through the body", "Arteries carry blood away from the heart", "Veins carry blood back to the heart", "Blood picks up oxygen in the lungs", "Circulation delivers oxygen and nutrients to cells"],
    visualPrompt: "Create a simplified circulation diagram with the heart at the center. Use red arrows for oxygen-rich blood moving from lungs to heart to body, and blue arrows for oxygen-poor blood moving from body to heart to lungs. Show three main zones: Lungs, Heart, Body Cells. Add labels for arteries, veins, oxygen pickup, and oxygen delivery. Keep the route visually clear and avoid complex heart anatomy.",
  },
  "Nervous System Infographic": {
    coreConcept: "Explain how the nervous system sends signals and coordinates body responses.",
    knowledgePoints: ["The brain processes information", "The spinal cord carries signals between brain and body", "Nerves send messages throughout the body", "Sensory signals detect changes", "Motor signals help control movement"],
    visualPrompt: "Create a full-body simplified silhouette with the brain, spinal cord, and branching nerves highlighted. Use signal arrows showing messages traveling from sensory input to the brain and from the brain to muscles. Add three labeled zones: Brain, Spinal Cord, Peripheral Nerves. Include two mini-panels named Sensory Signal and Motor Signal. Keep the visual clean, educational, and not medically complex.",
  },
  "Food Chain Infographic": {
    coreConcept: "Explain how energy moves from one organism to another in a food chain.",
    knowledgePoints: ["Producers make their own food", "Primary consumers eat producers", "Secondary consumers eat other consumers", "Predators and prey are connected", "Decomposers recycle nutrients"],
    visualPrompt: "Create a simple left-to-right or top-to-bottom food chain using clear icons: sun, grass or plant, herbivore, small carnivore, top predator, and decomposer fungi or bacteria. Use arrows to show energy flow. Add labels Producer, Primary Consumer, Secondary Consumer, Top Predator, Decomposer. Include a small note that decomposers recycle nutrients. Keep the chain simple and avoid too many animals.",
  },
  "Ecosystem Energy Flow Infographic": {
    coreConcept: "Explain how energy flows through an ecosystem.",
    knowledgePoints: ["Sunlight is the main energy source for most ecosystems", "Producers convert sunlight into stored energy", "Consumers get energy by eating organisms", "Energy decreases at higher trophic levels", "Decomposers return nutrients to the environment"],
    visualPrompt: "Create an energy pyramid infographic. Put producers at the wide base, primary consumers above, secondary consumers above them, and top consumers at the peak. Place the sun beside the pyramid with an arrow into producers. Add decomposers near the side with arrows returning nutrients to the base. Use short labels and a clear hierarchy. Avoid exact percentages and use general wording like less available energy upward.",
  },
  "Mitosis Cell Division Infographic": {
    coreConcept: "Explain how mitosis produces two identical daughter cells.",
    knowledgePoints: ["Chromosomes condense during prophase", "Chromosomes line up during metaphase", "Sister chromatids separate during anaphase", "New nuclei form during telophase", "Cytokinesis divides the cell"],
    visualPrompt: "Create a step-by-step vertical process infographic with five stages: Prophase, Metaphase, Anaphase, Telophase, Cytokinesis. Show a simplified cell diagram for each stage with visible X-shaped chromosomes. Use arrows between stages and one short label under each stage. End with two daughter cells. Keep text minimal and avoid overly detailed molecular biology.",
  },
  "Meiosis Process Infographic": {
    coreConcept: "Explain how meiosis forms gametes with genetic variation.",
    knowledgePoints: ["Meiosis has two rounds of division", "Chromosome number is reduced", "Gametes are produced", "Genetic variation can increase through recombination", "Meiosis supports sexual reproduction"],
    visualPrompt: "Create a two-phase process infographic labeled Meiosis I and Meiosis II. Show one starting cell with paired chromosomes, then two cells after the first division, then four gamete cells after the second division. Include a small crossover or recombination visual in the early stage. Use labels Chromosome Pairing, Recombination, First Division, Second Division, Four Gametes. Keep chromosome diagrams simple and readable.",
  },
  "Protein Synthesis Infographic": {
    coreConcept: "Explain how cells use genetic information to build proteins.",
    knowledgePoints: ["DNA contains instructions", "mRNA carries a copied message", "Ribosomes read the mRNA sequence", "Amino acids are joined together", "Proteins fold and perform cell functions"],
    visualPrompt: "Create a visual flow from DNA to mRNA to ribosome to protein. Use four large stages arranged vertically or diagonally. Show DNA inside a nucleus, mRNA leaving the nucleus, a ribosome reading mRNA, and amino acids joining into a chain that folds into a protein. Use labels DNA, mRNA, Ribosome, Amino Acids, Protein. Avoid fake sequences and excessive molecular detail.",
  },
  "Enzyme Function Infographic": {
    coreConcept: "Explain how enzymes help speed up biological reactions.",
    knowledgePoints: ["Enzymes are biological catalysts", "Substrates bind to the active site", "Enzymes help lower the energy needed for reactions", "Enzymes are specific to certain reactions", "Temperature and pH can affect enzyme activity"],
    visualPrompt: "Create a clear enzyme-substrate diagram. Show a large enzyme shape with an active site, a matching substrate shape approaching it, an enzyme-substrate complex, and products being released. Use a three-step flow: Bind, React, Release. Add a small side note panel showing that temperature and pH can affect enzyme activity. Use simple shapes and large labels.",
  },
  "Immune System Infographic": {
    coreConcept: "Explain the basic immune response against pathogens.",
    knowledgePoints: ["Barriers help prevent pathogens from entering", "White blood cells recognize threats", "Antibodies can help target specific pathogens", "Immune memory helps the body respond faster later", "The immune system protects against infection"],
    visualPrompt: "Create an immune defense infographic with a layered shield concept. Show outer barriers such as skin and mucus as the first layer, white blood cells as the second layer, antibodies targeting pathogens as the third layer, and immune memory as a small final panel. Use simple pathogen icons, shield shapes, and arrows. Avoid medical treatment advice or vaccine claims.",
  },
  "Bacteria vs Virus Infographic": {
    coreConcept: "Compare basic differences between bacteria and viruses.",
    knowledgePoints: ["Bacteria are living single-celled organisms", "Viruses are much smaller and need host cells to reproduce", "Bacteria can reproduce on their own", "Viruses carry genetic material inside a protein coat", "Antibiotics work against many bacteria but not viruses"],
    visualPrompt: "Create a side-by-side comparison. Put Bacteria on the left with a single-celled organism diagram showing cell wall, membrane, cytoplasm, and DNA. Put Virus on the right with a smaller particle showing protein coat and genetic material. Add comparison rows: Living Cell, Size, Reproduction, Structure, Antibiotics. Keep the language general and educational.",
  },
  "Human Skeleton Infographic": {
    coreConcept: "Explain the main functions and major parts of the human skeleton.",
    knowledgePoints: ["The skull protects the brain", "The spine supports the body and protects the spinal cord", "Ribs help protect the heart and lungs", "Limb bones support movement", "Bones store minerals and help make blood cells"],
    visualPrompt: "Create a front-facing simplified human skeleton diagram. Label skull, spine, ribs, pelvis, arm bones, and leg bones. Add five compact function cards around the skeleton: Support, Protection, Movement, Mineral Storage, Blood Cell Formation. Keep the anatomy clean and simplified. Avoid scary or overly realistic medical imagery.",
  },
  "Muscle System Infographic": {
    coreConcept: "Explain the three main types of muscle and their functions.",
    knowledgePoints: ["Skeletal muscles help move the body", "Smooth muscles work in internal organs", "Cardiac muscle pumps blood through the heart", "Muscles contract and relax", "Muscles work with bones and nerves"],
    visualPrompt: "Create an infographic divided into three panels: Skeletal Muscle, Smooth Muscle, Cardiac Muscle. Show simplified visuals for each: arm muscle attached to bone, smooth muscle around an organ tube, and heart muscle. Add a small central concept showing muscles contract and relax. Use clean anatomical icons instead of overly detailed medical drawings.",
  },
  "Brain Regions Infographic": {
    coreConcept: "Explain major brain regions and their basic roles.",
    knowledgePoints: ["The cerebrum supports thinking, memory, and voluntary movement", "The cerebellum helps coordination and balance", "The brainstem controls basic life functions", "Different regions work together", "The brain receives and processes sensory information"],
    visualPrompt: "Create a side-view brain diagram with color-coded regions. Label cerebrum, cerebellum, and brainstem. Add three callout cards explaining thinking and memory, balance and coordination, and basic life functions. Include a subtle signal arrow showing sensory information entering the brain. Keep labels large and avoid complex neuroscience terms.",
  },
  "Plant Life Cycle Infographic": {
    coreConcept: "Explain the major stages in a flowering plant life cycle.",
    knowledgePoints: ["Seeds contain a young plant", "Germination begins when conditions are suitable", "Seedlings grow leaves and roots", "Mature plants produce flowers", "Pollination and seed formation continue the cycle"],
    visualPrompt: "Create a circular life cycle infographic with five stages: Seed, Germination, Seedling, Mature Plant, Flower and Seeds. Use arrows around the circle and simple plant illustrations at each stage. Add small icons for water, sunlight, and soil near germination. Keep the visual friendly, accurate, and classroom-ready.",
  },
  "Butterfly Life Cycle Infographic": {
    coreConcept: "Explain complete metamorphosis in a butterfly.",
    knowledgePoints: ["The life cycle begins with an egg", "A caterpillar larva grows and eats", "A pupa forms during transformation", "The adult butterfly emerges", "Adults reproduce and lay eggs"],
    visualPrompt: "Create a four-stage circular life cycle infographic. Show Egg, Caterpillar, Pupa, and Adult Butterfly as large clear illustrations. Use arrows between stages. Add one short label for each stage and a title at the top. Keep the design bright, clean, and suitable for classroom learning.",
  },
  "Frog Life Cycle Infographic": {
    coreConcept: "Explain the major stages of frog development.",
    knowledgePoints: ["Frogs begin as eggs in water", "Tadpoles hatch and live in water", "Legs develop during growth", "Froglets begin to look like adult frogs", "Adult frogs can live on land and in water"],
    visualPrompt: "Create a circular or vertical life cycle infographic with stages: Eggs, Tadpole, Tadpole with Legs, Froglet, Adult Frog. Use a simple pond background while keeping the page clean. Use arrows to show development and short labels for each stage. Avoid excessive natural scenery that distracts from the learning sequence.",
  },
  "Human Eye Anatomy Infographic": {
    coreConcept: "Explain the basic parts of the eye and how they help vision.",
    knowledgePoints: ["The cornea helps focus incoming light", "The pupil controls how much light enters", "The lens focuses light onto the retina", "The retina detects light signals", "The optic nerve sends signals to the brain"],
    visualPrompt: "Create a cross-section diagram of the human eye. Show incoming light entering through the cornea and pupil, passing through the lens, focusing on the retina, then signals traveling through the optic nerve. Use callout labels for cornea, pupil, lens, retina, and optic nerve. Keep anatomy simplified and accurate. Avoid medical diagnosis content.",
  },
  "Human Ear Anatomy Infographic": {
    coreConcept: "Explain the basic parts of the ear and how hearing works.",
    knowledgePoints: ["The outer ear collects sound waves", "The eardrum vibrates when sound reaches it", "Small bones transfer vibrations", "The cochlea converts vibrations into nerve signals", "The auditory nerve sends signals to the brain"],
    visualPrompt: "Create a side cross-section diagram of the ear. Show sound waves entering the outer ear, reaching the eardrum, moving through small middle ear bones, entering the cochlea, and traveling as nerve signals through the auditory nerve. Use a simple flow arrow and labels Outer Ear, Eardrum, Middle Ear Bones, Cochlea, Auditory Nerve. Keep it clean and readable.",
  },
  "Genetics Basics Infographic": {
    coreConcept: "Explain basic genetics terms and inheritance ideas.",
    knowledgePoints: ["Genes are segments of DNA", "Chromosomes carry many genes", "Traits can be influenced by inherited information", "Alleles are different versions of a gene", "Offspring inherit genetic information from parents"],
    visualPrompt: "Create a layered genetics diagram showing DNA coiled into chromosomes, chromosomes inside a cell nucleus, and traits represented by simple icons. Use short definition cards for Gene, Chromosome, Allele, Trait, Inheritance. Add a simple parent-to-offspring arrow diagram. Avoid complex Punnett square detail unless it is very simple.",
  },
  "Natural Selection Infographic": {
    coreConcept: "Explain the basic process of natural selection.",
    knowledgePoints: ["Individuals in a population vary", "Some traits help organisms survive or reproduce", "Helpful traits can become more common over generations", "Environments influence which traits are advantageous", "Natural selection contributes to adaptation"],
    visualPrompt: "Create a step-by-step evolutionary process infographic. Use a simple population of small organisms with visible variation. Show an environmental pressure, survival of better-suited individuals, reproduction, and a later generation with more helpful traits. Use labels Variation, Selection Pressure, Survival, Reproduction, Adaptation. Avoid implying that individuals choose to evolve.",
  },
  "Biodiversity Infographic": {
    coreConcept: "Explain what biodiversity means and why it matters.",
    knowledgePoints: ["Biodiversity includes variety of species", "Genetic diversity helps populations adapt", "Ecosystem diversity supports different habitats", "Biodiversity supports food webs and ecosystem stability", "Human activity can affect biodiversity"],
    visualPrompt: "Create a rich but organized biodiversity infographic with three main panels: Species Diversity, Genetic Diversity, Ecosystem Diversity. Show different plants, animals, and habitats in a structured grid. Add a small food web or ecosystem stability icon. Keep it visually diverse but not cluttered. Avoid political claims or unsupported statistics.",
  },
  "Human Body Systems Infographic": {
    coreConcept: "Explain how major body systems work together.",
    knowledgePoints: ["The digestive system breaks down food", "The respiratory system exchanges gases", "The circulatory system transports materials", "The nervous system sends signals", "Body systems work together to maintain life"],
    visualPrompt: "Create an infographic with a simplified human silhouette in the center and five surrounding system icons: Digestive, Respiratory, Circulatory, Nervous, Skeletal or Muscular. Use arrows showing that systems interact. Add short labels for each system role. Keep the design clean, non-medical, and classroom-friendly.",
  },
  "Microscope Parts Infographic": {
    coreConcept: "Explain the main parts of a light microscope and their functions.",
    knowledgePoints: ["The eyepiece helps magnify the image", "Objective lenses provide different magnification levels", "The stage holds the slide", "Focus knobs sharpen the image", "The light source helps illuminate the specimen"],
    visualPrompt: "Create a labeled diagram of a light microscope as the main visual. Use callout lines to label eyepiece, objective lenses, stage, focus knobs, arm, base, and light source. Add a small section titled How it helps you see tiny details. Keep the microscope diagram accurate and avoid unnecessary lab clutter.",
  },
  "Levels of Biological Organization Infographic": {
    coreConcept: "Explain how living things are organized from small to large levels.",
    knowledgePoints: ["Cells are the basic unit of life", "Tissues are groups of similar cells", "Organs contain different tissues", "Organ systems work together", "Organisms interact within populations, communities, and ecosystems"],
    visualPrompt: "Create a vertical hierarchy infographic from smallest to largest. Use stacked levels: Cell, Tissue, Organ, Organ System, Organism, Population, Community, Ecosystem. Add a simple icon for each level. Use upward arrows or a ladder structure. Keep the hierarchy clear and avoid too many words.",
  },
};

function buildTemplate(title: string, index: number) {
  const topic = topicName(title);
  const slug = slugify(title);
  const aspectRatio = index < 5 ? "16:9" : "9:16";
  const kind = topicKind(topic);
  const custom = customTemplateDetails[title];
  const points = custom?.knowledgePoints ?? knowledgePoints(topic, kind);
  const style = styleName(topic);
  const preview = previewImages[index % previewImages.length];
  const detailPath = `/infographic/biology/${slug}/`;
  const canonicalUrl = `${siteUrl}${detailPath}`;
  const imageFilename = `biology-${slug}.webp`;
  const generated = readGeneratedTemplateManifest()[slug];
  const shortDescription = `A ready-to-use ${topic.toLowerCase()} infographic template for biology lessons, study guides, and science education.`;
  const coreConcept = custom?.coreConcept ?? `Explain ${topic} with clear sections, concise terms, and accurate beginner-friendly biology.`;
  const coreSummary = coreConcept.replace(/^Explain\s+/i, "").replace(/\.$/, "");
  const visibleDescription = `This ${title.toLowerCase()} template explains ${coreSummary} in a clear visual format. It is designed for students, teachers, science creators, and education content teams who need biology ideas organized into easy-to-understand visuals. The layout highlights ${points.slice(0, 3).join(", ")}, making it useful for lessons, presentations, social media posts, and visual learning materials. You can use the prompt behind this example to create a similar infographic with KnowLens AI. For users starting from their own text, KnowLens also works as a Biology Infographic Generator for structured biology visuals.`;
  const promptTopic = `${coreConcept} Cover ${points.join(", ")}.`;
  const rawPromptVisual = custom
    ? `${custom.visualPrompt} Compose it as a ${aspectRatio} infographic. Use English only, keep all text large and mobile-readable, align with ${style}, and avoid tiny text, fake data, random numbers, unrelated decorations, or misleading biology.`
    : visualPrompt(topic, kind, aspectRatio);
  const promptVisual = cleanImagePromptText(rawPromptVisual);
  const visibleTerms = points.slice(0, 4).map(toVisibleTerm);
  const finalPrompt = `Create a professional educational biology infographic about ${title}.\n\nCore learning goal:\n${coreConcept}\n\nScientific content:\n${points.map((point) => `- ${point}`).join("\n")}\n\nDetailed visual scene:\n${promptVisual}\n${imageQualityPrompt}\n\nAllowed visible words:\n- ${topic}\n${visibleTerms.map((term) => `- ${term}`).join("\n")}\n\nStyle:\n${stylePrompt(style)}\n\nAspect ratio:\n${aspectRatio}\n\nText requirements:\nUse English only. Keep all text short, large, and readable. Use only real biology terms and avoid long paragraphs.\n\nAccuracy requirements:\nKeep the biology explanation accurate, beginner-friendly, and stable. Do not invent statistics, research claims, medical advice, or treatment advice.\n\nNegative requirements:\nNo fake logos, no watermark, no random numbers, no unreadable text, no generic placeholders, no misleading anatomy, no distorted diagrams, no extra unrelated objects, no overly crowded layout.`;
  return {
    id: `biology-template-${String(index + 1).padStart(3, "0")}`,
    batchId: "biology-infographic-static-100",
    batchTopic: "Biology Infographic",
    generationProvider: generated?.generationProvider || "static-template",
    generationStatus: generated?.generationStatus || "success",
    categorySlug,
    categoryName,
    categoryKeyword,
    slug,
    canonicalUrl,
    detailPath,
    title: `${title} Template`,
    topicName: topic,
    shortDescription,
    visibleDescription,
    seoTitle: `${title} Template - KnowLens AI`,
    metaDescription: `Explore this ${topic.toLowerCase()} infographic template for biology lessons and science education. Create a similar visual with KnowLens AI.`,
    h1: `${title} Template`,
    primaryKeyword: title,
    secondaryKeywords: [`${topic.toLowerCase()} diagram`, "biology infographic template", "science infographic template", "biology visual learning"],
    generatorKeywords,
    previewImagePath: generated?.previewImageUrl ? new URL(generated.previewImageUrl).pathname : preview.path,
    previewImageUrl: generated?.previewImageUrl || `${siteUrl}${preview.path}`,
    storageKey: generated?.storageKey || `infographic/biology/${imageFilename}`,
    imageFilename: generated?.imageFilename || imageFilename,
    imageFormat: generated?.imageFormat || ("webp" as const),
    imageMimeType: generated?.imageMimeType || "image/webp",
    imageWidth: generated?.imageWidth || (aspectRatio === "16:9" ? 1600 : 1080),
    imageHeight: generated?.imageHeight || (aspectRatio === "16:9" ? 900 : 1920),
    imageSizeBytes: generated?.imageSizeBytes,
    sourcePreviewWidth: preview.width,
    sourcePreviewHeight: preview.height,
    aspectRatio,
    imageAlt: `${title.toLowerCase()} showing ${points.slice(0, 4).join(", ")}`,
    imageTitle: `${title} Template`,
    imageCaption: `${title} - a biology infographic example created with KnowLens AI.`,
    imageDescription: `This ${topic.toLowerCase()} infographic explains ${points[0]} with a clear visual structure. It highlights ${points.slice(1, 4).join(", ")}, making it useful for students, teachers, and science content creators.`,
    styleName: style,
    stylePrompt: stylePrompt(style),
    topicPrompt: promptTopic,
    visualPrompt: promptVisual,
    finalPrompt,
    createSimilarPrompt: `Create an educational biology infographic about ${topic}. Explain ${points[0]} with clear sections, concise English terms, and a structured visual layout. Use ${style}. Aspect ratio: ${aspectRatio}. Include the key points: ${points.slice(0, 4).join(", ")}. Main visual idea: ${promptVisual} ${imageQualityPrompt}`,
    knowledgePoints: points,
    useCases: ["biology lessons", "classroom materials", "science presentations", "visual learning content", "study guides"],
    targetAudience: ["students", "teachers", "science creators", "biology learners"],
    tags: Array.from(new Set(["biology", "infographic", "visual learning", kind, ...slug.split("-").filter((part) => part !== "infographic").slice(0, 5)])),
    relatedTemplateIds: [] as string[],
    relatedCategorySlugs: ["science", "education", "earth-science", "technology"],
    relatedToolSlugs: ["biology-infographic-generator", "science-infographic-generator", "educational-infographic-maker", "ai-infographic-generator"],
    allowPublicDownload: false as const,
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: generated?.updatedAt || "2026-06-12T00:00:00.000Z",
  };
}

export function getBiologyInfographicTemplates() {
  return topicTitles.map(buildTemplate).map((template, index, source) => ({
  ...template,
  relatedTemplateIds: [1, 2, 3, 4, 5, 6]
    .map((offset) => source[(index + offset) % source.length].id)
    .filter((id) => id !== template.id)
    .slice(0, 6),
  }));
}

export const biologyInfographicTemplates = getBiologyInfographicTemplates();

export function getBiologyInfographicTemplate(slug: string) {
  const decoded = decodeURIComponent(slug).toLowerCase();
  return getBiologyInfographicTemplates().find((template) => template.slug === decoded) ?? null;
}
