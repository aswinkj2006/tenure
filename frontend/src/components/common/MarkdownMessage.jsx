import React from 'react';
import './MarkdownMessage.css';

/**
 * Parses inline markdown: **bold**, *italic*, `code`
 */
function parseInline(text) {
  if (!text) return null;

  // Split by inline markdown tokens
  const parts = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // Check for bold **...**
    const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
    // Check for code `...`
    const codeMatch = remaining.match(/`([^`]+)`/);
    // Check for italic *...*
    const italicMatch = remaining.match(/\*([^*]+)\*/);

    let firstMatch = null;
    let type = null;

    if (boldMatch) {
      firstMatch = boldMatch;
      type = 'bold';
    }
    if (codeMatch && (!firstMatch || codeMatch.index < firstMatch.index)) {
      firstMatch = codeMatch;
      type = 'code';
    }
    if (italicMatch && (!firstMatch || italicMatch.index < firstMatch.index)) {
      // make sure it wasn't part of **
      if (!remaining.slice(italicMatch.index - 1, italicMatch.index + 1).includes('**')) {
        firstMatch = italicMatch;
        type = 'italic';
      }
    }

    if (!firstMatch || firstMatch.index === undefined) {
      parts.push(remaining);
      break;
    }

    if (firstMatch.index > 0) {
      parts.push(remaining.substring(0, firstMatch.index));
    }

    if (type === 'bold') {
      parts.push(<strong key={keyIdx++} className="md-bold">{firstMatch[1]}</strong>);
    } else if (type === 'code') {
      parts.push(<code key={keyIdx++} className="md-code">{firstMatch[1]}</code>);
    } else if (type === 'italic') {
      parts.push(<em key={keyIdx++} className="md-italic">{firstMatch[1]}</em>);
    }

    remaining = remaining.substring(firstMatch.index + firstMatch[0].length);
  }

  return parts;
}

/**
 * Zero-dependency robust Markdown Renderer for LLM responses.
 */
export default function MarkdownMessage({ content = '' }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let listItems = [];
  let listType = null; // 'ul' | 'ol'

  const flushList = () => {
    if (listItems.length > 0) {
      if (listType === 'ol') {
        elements.push(
          <ol key={`ol-${elements.length}`} className="md-ol">
            {listItems.map((item, idx) => (
              <li key={idx} className="md-li">{parseInline(item)}</li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${elements.length}`} className="md-ul">
            {listItems.map((item, idx) => (
              <li key={idx} className="md-li">{parseInline(item)}</li>
            ))}
          </ul>
        );
      }
      listItems = [];
      listType = null;
    }
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      return;
    }

    // Horizontal rule
    if (line === '---' || line === '***' || line === '___') {
      flushList();
      elements.push(<hr key={`hr-${idx}`} className="md-hr" />);
      return;
    }

    // Headings
    if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <h4 key={`h3-${idx}`} className="md-h3">
          {parseInline(line.replace(/^###\s+/, ''))}
        </h4>
      );
      return;
    }
    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h3 key={`h2-${idx}`} className="md-h2">
          {parseInline(line.replace(/^##\s+/, ''))}
        </h3>
      );
      return;
    }
    if (line.startsWith('# ')) {
      flushList();
      elements.push(
        <h2 key={`h1-${idx}`} className="md-h1">
          {parseInline(line.replace(/^#\s+/, ''))}
        </h2>
      );
      return;
    }

    // Bullet lists: *, -, •
    const bulletMatch = line.match(/^[-*•]\s+(.+)/);
    if (bulletMatch) {
      if (listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(bulletMatch[1]);
      return;
    }

    // Numbered lists: 1.
    const numMatch = line.match(/^\d+\.\s+(.+)/);
    if (numMatch) {
      if (listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(numMatch[1]);
      return;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={`p-${idx}`} className="md-p">
        {parseInline(line)}
      </p>
    );
  });

  flushList();

  return <div className="markdown-message">{elements}</div>;
}
