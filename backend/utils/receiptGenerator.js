const fs = require("fs");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  BorderStyle,
  TabStopType,
  TabStopPosition,
} = require("docx");

const NAVY = "0B2545";
const GOLD = "C99B3D";

function labelParagraph(text) {
  return new Paragraph({
    spacing: { before: 200, after: 60 },
    children: [new TextRun({ text, bold: true, size: 24, color: NAVY })],
  });
}

function bodyParagraph(text, { justify = false, spacingAfter = 0 } = {}) {
  return new Paragraph({
    alignment: justify ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
    spacing: { after: spacingAfter },
    children: [new TextRun({ text: text || "", size: 22 })],
  });
}

/**
 * Generates a formatted "submission receipt" as a real .docx file (no PDF
 * anywhere in this system — see the file-type rule this replaces). Every
 * page gets the journal name in the header (with a gold accent rule) and
 * "<journal short name> · Page X of Y" in the footer, using Word's live
 * PAGE/NUMPAGES fields so it stays correct regardless of how Word paginates
 * the content.
 *
 * @param {object} paper   - { title, abstract, keywords, submitted_at }
 * @param {object} author  - { name, email, affiliation }
 * @param {object} journal - { name, short_name }
 * @param {string} outputPath - absolute path to write the .docx to
 */
async function generateSubmissionReceipt({ paper, author, journal, outputPath }) {
  const journalName = journal?.name || "SIAHSSR Journal";
  const journalShort = journal?.short_name || "";

  const header = new Header({
    children: [
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GOLD, space: 6 } },
        spacing: { after: 120 },
        children: [
          new TextRun({ text: journalName, bold: true, size: 26, color: NAVY }),
          ...(journalShort ? [new TextRun({ text: `   ·   ${journalShort}`, size: 20, color: GOLD })] : []),
        ],
      }),
    ],
  });

  const footer = new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 6 } },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: journalShort || journalName, size: 16, color: "555555" }),
          new TextRun({ text: "\t" }),
          new TextRun({ text: "Page ", size: 16, color: "555555" }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "555555" }),
          new TextRun({ text: " of ", size: 16, color: "555555" }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "555555" }),
        ],
      }),
    ],
  });

  const body = [
    new Paragraph({
      text: "Paper Submission Acknowledgement",
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),

    labelParagraph("Title"),
    bodyParagraph(paper.title, { spacingAfter: 160 }),

    labelParagraph("Author"),
    bodyParagraph(`${author.name}${author.affiliation ? " — " + author.affiliation : ""}`),
    bodyParagraph(author.email, { spacingAfter: 160 }),

    labelParagraph("Abstract"),
    bodyParagraph(paper.abstract, { justify: true, spacingAfter: 160 }),

    ...(paper.keywords ? [labelParagraph("Keywords"), bodyParagraph(paper.keywords, { spacingAfter: 160 })] : []),

    labelParagraph("Submission Details"),
    bodyParagraph(`Journal: ${journalName}`),
    bodyParagraph(`Submitted on: ${new Date(paper.submitted_at || Date.now()).toLocaleString()}`),
    bodyParagraph("Status: Submitted — pending review", { spacingAfter: 300 }),

    new Paragraph({
      children: [
        new TextRun({
          text: "This document confirms receipt of your submission. It is not a confirmation of acceptance for publication.",
          italics: true,
          size: 18,
          color: "666666",
        }),
      ],
    }),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {},
        headers: { default: header },
        footers: { default: footer },
        children: body,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

/**
 * Generates a "Certificate of Publication" as a .docx — a keepsake authors can
 * download once their paper is published (for a CV, a promotion file, etc.).
 * Same letterhead header as the submission receipt, but the body reads as a
 * certificate: centered, a gold double-rule frame, and the journal's
 * volume/issue/ISSN/DOI details.
 *
 * @param {object} paper   - { title, volume, issue, published_at, doi }
 * @param {object} author  - { name, affiliation }
 * @param {object} journal - { name, short_name, issn }
 * @param {string} outputPath - absolute path to write the .docx to
 */
async function generatePublicationCertificate({ paper, author, journal, outputPath }) {
  const journalName = journal?.name || "SIAHSSR Journal";
  const journalShort = journal?.short_name || "";

  const header = new Header({
    children: [
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GOLD, space: 6 } },
        spacing: { after: 120 },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: journalName, bold: true, size: 26, color: NAVY }),
          ...(journalShort ? [new TextRun({ text: `   ·   ${journalShort}`, size: 20, color: GOLD })] : []),
        ],
      }),
    ],
  });

  const footer = new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 6 } },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "This certificate confirms publication in the issue named above. Verify at the journal's Papers Archive.",
            size: 15,
            color: "777777",
            italics: true,
          }),
        ],
      }),
    ],
  });

  const issueLine = [paper.volume ? `Volume ${paper.volume}` : null, paper.issue ? `Issue ${paper.issue}` : null]
    .filter(Boolean)
    .join(", ");

  const body = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.DOUBLE, size: 6, color: GOLD, space: 12 } },
      spacing: { before: 200, after: 80 },
      children: [new TextRun({ text: "" })],
    }),
    new Paragraph({
      text: "Certificate of Publication",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 260 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: "This is to certify that the paper", size: 22, color: "444444" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: `“${paper.title}”`, bold: true, italics: true, size: 30, color: NAVY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: "authored by", size: 22, color: "444444" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 260 },
      children: [
        new TextRun({
          text: `${author.name}${author.affiliation ? " — " + author.affiliation : ""}`,
          bold: true,
          size: 26,
          color: NAVY,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: `has been peer-reviewed and published in ${journalName}${journalShort ? ` (${journalShort})` : ""}`,
          size: 21,
          color: "444444",
        }),
      ],
    }),
    ...(issueLine
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [new TextRun({ text: issueLine, size: 21, color: "444444" })],
          }),
        ]
      : []),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: `Published on ${new Date(paper.published_at || Date.now()).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`,
          size: 21,
          color: "444444",
        }),
      ],
    }),
    ...(journal?.issn
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [new TextRun({ text: `ISSN ${journal.issn}`, size: 18, color: "666666" })],
          }),
        ]
      : []),
    ...(paper.doi
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: `DOI: ${paper.doi}`, size: 18, color: "666666" })],
          }),
        ]
      : [new Paragraph({ spacing: { after: 200 }, children: [] })]),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.DOUBLE, size: 6, color: GOLD, space: 12 } },
      spacing: { after: 40 },
      children: [new TextRun({ text: "" })],
    }),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {},
        headers: { default: header },
        footers: { default: footer },
        children: body,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

module.exports = { generateSubmissionReceipt, generatePublicationCertificate };
