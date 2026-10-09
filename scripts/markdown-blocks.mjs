/**
 * markdown-blocks.mjs - split Markdown into blocks with line numbers.
 *
 * The block processor (scripts/block-processor.js) and its tests import the parser from here, so the tests run the
 * code the index job runs. No side effects: importing this module reads and writes nothing.
 */

// Block types we recognize
export const BLOCK_TYPES = {
  HEADING: 'heading',
  PARAGRAPH: 'paragraph',
  CODE: 'code',
  LIST: 'list',
  BLOCKQUOTE: 'blockquote',
  TABLE: 'table',
  HTML: 'html'
};

/**
 * Parse markdown content into blocks with line numbers
 */
export function parseMarkdownToBlocks(content) {
  const lines = content.split('\n');
  const blocks = [];
  let currentBlock = null;
  let inCodeBlock = false;
  let codeBlockLang = '';
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Handle code blocks
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        // Start code block
        if (currentBlock) {
          currentBlock.endLine = lineNum - 1;
          blocks.push(currentBlock);
        }
        codeBlockLang = trimmed.slice(3).trim();
        currentBlock = {
          type: BLOCK_TYPES.CODE,
          line: lineNum,
          content: [],
          language: codeBlockLang
        };
        inCodeBlock = true;
      } else {
        // End code block
        currentBlock.content.push(line);
        currentBlock.endLine = lineNum;
        blocks.push(currentBlock);
        currentBlock = null;
        inCodeBlock = false;
      }
      continue;
    }

    if (inCodeBlock) {
      currentBlock.content.push(line);
      continue;
    }

    // Handle headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (currentBlock) {
        currentBlock.endLine = lineNum - 1;
        blocks.push(currentBlock);
      }
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const slug = generateSlug(text);
      
      currentBlock = {
        type: BLOCK_TYPES.HEADING,
        line: lineNum,
        endLine: lineNum,
        headingLevel: level,
        headingText: text,
        headingSlug: slug,
        content: [line]
      };
      blocks.push(currentBlock);
      currentBlock = null;
      continue;
    }

    // Handle blockquotes
    if (trimmed.startsWith('>')) {
      if (!currentBlock || currentBlock.type !== BLOCK_TYPES.BLOCKQUOTE) {
        if (currentBlock) {
          currentBlock.endLine = lineNum - 1;
          blocks.push(currentBlock);
        }
        currentBlock = {
          type: BLOCK_TYPES.BLOCKQUOTE,
          line: lineNum,
          content: []
        };
      }
      currentBlock.content.push(line);
      continue;
    }

    // Handle lists (unordered and ordered)
    const listMatch = trimmed.match(/^[-*+]|\d+\.\s/);
    if (listMatch) {
      if (!currentBlock || currentBlock.type !== BLOCK_TYPES.LIST) {
        if (currentBlock) {
          currentBlock.endLine = lineNum - 1;
          blocks.push(currentBlock);
        }
        currentBlock = {
          type: BLOCK_TYPES.LIST,
          line: lineNum,
          content: []
        };
      }
      currentBlock.content.push(line);
      continue;
    }

    // Handle tables
    if (trimmed.startsWith('|') || (trimmed.includes('|') && trimmed.match(/^\|?[\s-:|]+\|?$/))) {
      if (!currentBlock || currentBlock.type !== BLOCK_TYPES.TABLE) {
        if (currentBlock) {
          currentBlock.endLine = lineNum - 1;
          blocks.push(currentBlock);
        }
        currentBlock = {
          type: BLOCK_TYPES.TABLE,
          line: lineNum,
          content: []
        };
        inTable = true;
      }
      currentBlock.content.push(line);
      continue;
    } else if (inTable && currentBlock) {
      // End table
      currentBlock.endLine = lineNum - 1;
      blocks.push(currentBlock);
      currentBlock = null;
      inTable = false;
    }

    // Handle HTML blocks
    if (trimmed.startsWith('<') && !trimmed.startsWith('<!--')) {
      if (currentBlock) {
        currentBlock.endLine = lineNum - 1;
        blocks.push(currentBlock);
      }
      currentBlock = {
        type: BLOCK_TYPES.HTML,
        line: lineNum,
        content: [line]
      };
      // Simple single-line HTML
      if (trimmed.endsWith('>') || trimmed.match(/<[^>]+\/>/)) {
        currentBlock.endLine = lineNum;
        blocks.push(currentBlock);
        currentBlock = null;
      }
      continue;
    }

    // Handle empty lines
    if (trimmed === '') {
      if (currentBlock && currentBlock.type !== BLOCK_TYPES.PARAGRAPH) {
        currentBlock.endLine = lineNum - 1;
        blocks.push(currentBlock);
        currentBlock = null;
      }
      continue;
    }

    // Default: paragraph
    if (!currentBlock || currentBlock.type !== BLOCK_TYPES.PARAGRAPH) {
      if (currentBlock) {
        currentBlock.endLine = lineNum - 1;
        blocks.push(currentBlock);
      }
      currentBlock = {
        type: BLOCK_TYPES.PARAGRAPH,
        line: lineNum,
        content: []
      };
    }
    currentBlock.content.push(line);
  }

  // Don't forget the last block
  if (currentBlock) {
    currentBlock.endLine = lines.length;
    blocks.push(currentBlock);
  }

  return blocks;
}

/**
 * Generate a URL-friendly slug from text
 */
export function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}
