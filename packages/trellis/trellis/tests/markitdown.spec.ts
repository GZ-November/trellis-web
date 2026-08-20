import { describe, expect, it } from 'vitest'
import { convertToMarkdown, decodeHtmlEntities } from '../src/markitdown.ts'

describe('decodeHtmlEntities', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeHtmlEntities('&amp; &lt; &gt; &quot; &#39; &#x2F; &mdash; &ndash;')).toBe('& < > " \' / — –')
    expect(decodeHtmlEntities('&#65;&#66;&#67;')).toBe('ABC')
    expect(decodeHtmlEntities('Hello&nbsp;World')).toBe('Hello World')
  })
})

describe('convertToMarkdown', () => {
  it('preserves plain text documents', () => {
    const text = '# My Course Notes\n\n- Point 1\n- Point 2'
    const result = convertToMarkdown(text)
    expect(result.title).toBe('My Course Notes')
    expect(result.markdown).toBe(text)
    expect(result.links).toEqual([])
    expect(result.excerpt).toContain('Point 1')
  })

  it('falls back to default title for non-heading plain text', () => {
    const text = 'Simple plain notes without heading.'
    const result = convertToMarkdown(text, 'Custom Fallback')
    expect(result.title).toBe('Simple plain notes without heading.')
  })

  it('strips script, style, noscript, svg, nav, and footer noise from HTML', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>CS101: Introduction to Computer Science</title>
          <style>.ad { color: red; }</style>
          <script>console.log('tracking')</script>
        </head>
        <body>
          <nav><a href="/home">Home</a></nav>
          <h1>Lecture 1: Algorithms</h1>
          <p>Welcome to <strong>CS101</strong>. Today we study <em>sorting</em>.</p>
          <svg><path d="M0 0"/></svg>
          <noscript>Please enable JavaScript</noscript>
          <footer>Copyright 2026 University</footer>
        </body>
      </html>
    `
    const result = convertToMarkdown(html)
    expect(result.title).toBe('CS101: Introduction to Computer Science')
    expect(result.markdown).toContain('# Lecture 1: Algorithms')
    expect(result.markdown).toContain('Welcome to **CS101**. Today we study *sorting*.')
    expect(result.markdown).not.toContain('tracking')
    expect(result.markdown).not.toContain('Copyright 2026')
    expect(result.markdown).not.toContain('Please enable JavaScript')
  })

  it('converts HTML tables into standard markdown tables', () => {
    const html = `
      <table>
        <thead>
          <tr><th>Week</th><th>Topic</th><th>Assignment</th></tr>
        </thead>
        <tbody>
          <tr><td>1</td><td>Python Basics</td><td>Lab 1</td></tr>
          <tr><td>2</td><td>Data Structures</td><td>Lab 2</td></tr>
        </tbody>
      </table>
    `
    const result = convertToMarkdown(html)
    expect(result.markdown).toContain('| Week | Topic | Assignment |')
    expect(result.markdown).toContain('| --- | --- | --- |')
    expect(result.markdown).toContain('| 1 | Python Basics | Lab 1 |')
    expect(result.markdown).toContain('| 2 | Data Structures | Lab 2 |')
  })

  it('handles empty or unbalanced tables gracefully', () => {
    const emptyResult = convertToMarkdown('<table></table>')
    expect(emptyResult.markdown).toBe('')
    expect(emptyResult.title).toBe('Webpage')
    const partial = '<table><tr><td>Only Cell</td></tr></table>'
    expect(convertToMarkdown(partial).markdown).toContain('| Only Cell |')
  })

  it('converts code blocks, blockquotes, and lists', () => {
    const html = `
      <h1>Python Course</h1>
      <p>Here is sample code:</p>
      <pre><code class="language-python">def solve(x):
    return x * 2</code></pre>
      <blockquote>Important note for final exam</blockquote>
      <ul>
        <li>Homework 1</li>
        <li>Homework 2</li>
      </ul>
      <p>Visit <a href="https://example.edu/course">Course Portal</a> for details.</p>
    `
    const result = convertToMarkdown(html)
    expect(result.markdown).toContain('```python\ndef solve(x):\n    return x * 2\n```')
    expect(result.markdown).toContain('> Important note for final exam')
    expect(result.markdown).toContain('- Homework 1')
    expect(result.markdown).toContain('- Homework 2')
    expect(result.markdown).toContain('[Course Portal](https://example.edu/course)')
    expect(result.links).toEqual([{ url: 'https://example.edu/course', text: 'Course Portal' }])
  })

  it('handles pre blocks without language tags and inline code', () => {
    const html = '<pre>plain pre</pre><p>inline <code>var a = 1</code></p>'
    const result = convertToMarkdown(html)
    expect(result.markdown).toContain('```\nplain pre\n```')
    expect(result.markdown).toContain('`var a = 1`')
  })
})
