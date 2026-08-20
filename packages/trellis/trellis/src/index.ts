/**
 * Trellis: a source-backed personal knowledge graph and workbench.
 *
 * The plugin opens the `trellis` storage domain and registers model-facing
 * tools for ingesting, connecting, retrieving, and visualizing source material,
 * alongside the existing academic and career record tools.
 *
 * @module @trellis/trellis
 */

import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { Domain, KvTable } from '@deepseek-ai/dsh-storage-domain'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { trellisDomainSpec } from './spec.ts'
import { TrellisKnowledge } from './knowledge.ts'
import type { TrellisKnowledgeConfig } from './knowledge.ts'
import { registerKnowledgeTools } from './knowledge-tools.ts'
import type {
  AcademicPlanRecord,
  ApplicationRecord,
  CompetitionRecord,
  ContactRecord,
  CourseRecord,
  DegreeRequirementRecord,
  JobRecord,
  NoteRecord,
  SourceRecord,
  KnowledgeDocumentRecord,
} from './spec.ts'
import type { TrellisDocumentId } from './types.ts'

export { trellisDomainSpec } from './spec.ts'
export { TrellisKnowledge } from './knowledge.ts'
export type {
  AcademicPlanRecord,
  ApplicationRecord,
  CompetitionRecord,
  ContactRecord,
  CourseRecord,
  DegreeRequirementRecord,
  JobRecord,
  NoteRecord,
  SourceRecord,
} from './spec.ts'
export type {
  TrellisDocumentRead,
  TrellisGraphEdge,
  TrellisGraphNode,
  TrellisGraphRequest,
  TrellisGraphSnapshot,
  TrellisIngestRequest,
  TrellisIngestResult,
  TrellisKnowledgeConfig,
  TrellisRelationInput,
  TrellisSearchHit,
} from './knowledge.ts'
export type { TrellisDocumentId, TrellisRelationId } from './types.ts'

/** Cordis function-plugin name. */
export const name = 'trellis'
/** Services required before the Trellis domain and tools can be installed. */
export const inject = ['storageDomain', 'tools', 'web', 'systemPrompt']

/** Trellis knowledge storage and projection limits. */
export interface Config {
  /** Cooperative tool budget for URL ingestion. */
  fetchTimeoutMs: number
  /** Maximum characters retained for one knowledge source. */
  maxContentChars: number
  /** Maximum document characters returned by one read. */
  maxReadChars: number
  /** Maximum hits returned by knowledge search. */
  maxSearchResults: number
  /** Maximum excerpt characters in one search hit. */
  maxSnippetChars: number
  /** Maximum nodes returned by one graph projection. */
  maxGraphNodes: number
  /** Maximum outgoing relations on one knowledge document. */
  maxRelationsPerDocument: number
}

/** Schemastery config schema for the Trellis plugin. */
export const Config: z<Config> = z.object({
  fetchTimeoutMs: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(30_000),
  maxContentChars: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(100_000),
  maxReadChars: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(20_000),
  maxSearchResults: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(20),
  maxSnippetChars: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(500),
  maxGraphNodes: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(500),
  maxRelationsPerDocument: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(32),
})

type TrellisDomain = Domain<typeof trellisDomainSpec>

const now = (): string => new Date().toISOString()
const newId = (prefix: string): string => `${prefix}-${randomUUID()}`

const jsonResult = (_args: unknown, value: JsonValue): ContentBlock[] =>
  [{ type: 'text', text: JSON.stringify(value, null, 2) }]

/** Convert a record to a JSON-safe value, dropping `undefined` fields. */
const jsonValue = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue

function registerJobTools(ctx: Context, jobs: KvTable<string, JobRecord>): void {
  ctx.tools.register(defineTool({
    name: 'trellis_job_import',
    description: 'Import one job posting into the Trellis career knowledge base. Pass the JD text or a URL; the tool stores the structured record and returns its id.',
    parameters: {
      title: { type: 'string', required: true, description: 'Job title.' },
      company: { type: 'string', required: true, description: 'Company or bank name.' },
      location: { type: 'string', description: 'Office location, if known.' },
      url: { type: 'string', description: 'Original posting URL.' },
      description: { type: 'string', description: 'Full job description text.' },
      posted_at: { type: 'string', description: 'Posting date as ISO-8601 or free text.' },
      deadline: { type: 'string', description: 'Application deadline as ISO-8601 or free text.' },
      status: { type: 'string', description: 'Tracking status: watching, applied, interviewing, offer, rejected.' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags such as bank type, division, or skill.' },
    },
    output: {
      schema: { type: 'json' },
      render: jsonResult,
    },
    async execute(args): Promise<JsonValue> {
      const existing = [...jobs.entries()].find(([, record]) =>
        (args.url !== undefined && record.url === args.url)
        || (record.title.toLowerCase() === args.title.toLowerCase() && record.company.toLowerCase() === args.company.toLowerCase()))
      const id = existing?.[0] ?? newId('job')
      const record: JobRecord = {
        id,
        title: args.title,
        company: args.company,
        location: args.location ?? existing?.[1].location,
        url: args.url ?? existing?.[1].url,
        description: args.description ?? existing?.[1].description ?? '',
        posted_at: args.posted_at ?? existing?.[1].posted_at,
        deadline: args.deadline ?? existing?.[1].deadline,
        status: args.status ?? existing?.[1].status ?? 'watching',
        tags: [...new Set([...(existing?.[1].tags ?? []), ...(args.tags ?? [])])],
        created_at: existing?.[1].created_at ?? now(),
        updated_at: now(),
      }
      await jobs.put(id, record)
      return jsonValue({ ok: true, id, record, created: existing === undefined })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'trellis_job_list',
    description: 'List all job postings currently stored in Trellis, optionally filtered by company or status.',
    parameters: {
      company: { type: 'string', description: 'Filter by exact company name.' },
      status: { type: 'string', description: 'Filter by status.' },
    },
    output: {
      schema: { type: 'json' },
      render: jsonResult,
    },
    execute(args): Promise<JsonValue> {
      const jobsList = [...jobs.entries()]
        .filter(([, record]) => (args.company === undefined || record.company === args.company)
          && (args.status === undefined || record.status === args.status))
        .map(([, record]) => record)
      return Promise.resolve(jsonValue({ ok: true, jobs: jobsList }))
    },
  }))
}

function registerContactTools(ctx: Context, contacts: KvTable<string, ContactRecord>): void {
  ctx.tools.register(defineTool({
    name: 'trellis_contact_import',
    description: 'Save one professional contact into Trellis, including LinkedIn URL, headline, and outreach stage.',
    parameters: {
      name: { type: 'string', required: true, description: 'Contact name.' },
      linkedin_url: { type: 'string', description: 'LinkedIn profile URL.' },
      headline: { type: 'string', description: 'Current headline or role.' },
      company: { type: 'string', description: 'Current company.' },
      relationship: { type: 'string', description: 'How you know them: alumni, colleague, recruiter, etc.' },
      notes: { type: 'string', description: 'Private notes about this contact.' },
      outreach_stage: { type: 'string', description: 'not_contacted, contacted, replied, meeting, done.' },
    },
    output: {
      schema: { type: 'json' },
      render: jsonResult,
    },
    async execute(args): Promise<JsonValue> {
      const existing = [...contacts.entries()].find(([, record]) =>
        (args.linkedin_url !== undefined && record.linkedin_url === args.linkedin_url)
        || (record.name.toLowerCase() === args.name.toLowerCase() && (args.company === undefined || record.company === args.company)))
      const id = existing?.[0] ?? newId('contact')
      const record: ContactRecord = {
        id,
        name: args.name,
        linkedin_url: args.linkedin_url ?? existing?.[1].linkedin_url,
        headline: args.headline ?? existing?.[1].headline,
        company: args.company ?? existing?.[1].company,
        relationship: args.relationship ?? existing?.[1].relationship,
        notes: args.notes ?? existing?.[1].notes ?? '',
        outreach_stage: args.outreach_stage ?? existing?.[1].outreach_stage ?? 'not_contacted',
        created_at: existing?.[1].created_at ?? now(),
        updated_at: now(),
      }
      await contacts.put(id, record)
      return jsonValue({ ok: true, id, record, created: existing === undefined })
    },
  }))
}

function registerApplicationTools(ctx: Context, applications: KvTable<string, ApplicationRecord>): void {
  ctx.tools.register(defineTool({
    name: 'trellis_application_upsert',
    description: 'Upsert one job application record, linking it to a Trellis job id and tracking status and next action.',
    parameters: {
      job_id: { type: 'string', required: true, description: 'Trellis job record id.' },
      applied_at: { type: 'string', description: 'Application date as ISO-8601 or free text.' },
      status: { type: 'string', description: 'draft, applied, interviewing, offer, rejected.' },
      resume_version: { type: 'string', description: 'Resume version or file name used.' },
      cover_letter: { type: 'string', description: 'Cover letter text or reference.' },
      next_action: { type: 'string', description: 'Next follow-up action.' },
    },
    output: {
      schema: { type: 'json' },
      render: jsonResult,
    },
    async execute(args): Promise<JsonValue> {
      const existing = [...applications.entries()].find(([, record]) => record.job_id === args.job_id)
      const id = existing?.[0] ?? newId('application')
      const record: ApplicationRecord = {
        id,
        job_id: args.job_id,
        applied_at: args.applied_at,
        status: args.status ?? existing?.[1].status ?? 'draft',
        resume_version: args.resume_version ?? existing?.[1].resume_version,
        cover_letter: args.cover_letter ?? existing?.[1].cover_letter ?? '',
        next_action: args.next_action ?? existing?.[1].next_action ?? '',
        created_at: existing?.[1].created_at ?? now(),
        updated_at: now(),
      }
      await applications.put(id, record)
      return jsonValue({ ok: true, id, record })
    },
  }))
}

function registerNoteTools(ctx: Context, notes: KvTable<string, NoteRecord>): void {
  ctx.tools.register(defineTool({
    name: 'trellis_note_create',
    description: 'Create a knowledge note in Trellis. Use tags and links to connect it to jobs, contacts, courses, or other notes.',
    parameters: {
      title: { type: 'string', required: true, description: 'Note title.' },
      content: { type: 'string', description: 'Markdown content.' },
      kind: { type: 'string', description: 'Note kind: note, article, jd, course, competition, etc.' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags for search.' },
      links: { type: 'array', items: { type: 'string' }, description: 'Linked Trellis record ids or [[wikilinks]].' },
      source_url: { type: 'string', description: 'Original source URL.' },
    },
    output: {
      schema: { type: 'json' },
      render: jsonResult,
    },
    async execute(args): Promise<JsonValue> {
      const id = newId('note')
      const record: NoteRecord = {
        id,
        title: args.title,
        content: args.content ?? '',
        kind: args.kind ?? 'note',
        tags: args.tags ?? [],
        links: args.links ?? [],
        source_url: args.source_url,
        created_at: now(),
        updated_at: now(),
      }
      await notes.put(id, record)
      return jsonValue({ ok: true, id, record })
    },
  }))
}

function registerCourseTools(
  ctx: Context,
  courses: KvTable<string, CourseRecord>,
  requirements: KvTable<string, DegreeRequirementRecord>,
  plans: KvTable<string, AcademicPlanRecord>,
): void {
  ctx.tools.register(defineTool({
    name: 'trellis_course_upsert',
    description: 'Upsert one course into Trellis. If a course with the same code already exists, update its fields instead of creating a duplicate.',
    parameters: {
      code: { type: 'string', required: true, description: 'Course code, e.g. FIN101.' },
      title: { type: 'string', required: true, description: 'Course title.' },
      credits: { type: 'number', required: true, description: 'Credit value.' },
      semester: { type: 'string', description: 'Term, e.g. 2026 Spring.' },
      grade: { type: 'string', description: 'Grade if completed.' },
      status: { type: 'string', description: 'planned, enrolled, completed, dropped.' },
      prerequisites: { type: 'array', items: { type: 'string' }, description: 'Prerequisite course codes.' },
    },
    output: {
      schema: { type: 'json' },
      render: jsonResult,
    },
    async execute(args): Promise<JsonValue> {
      const existing = [...courses.entries()].find(([, record]) => record.code === args.code)
      const id = existing?.[0] ?? newId('course')
      const record: CourseRecord = {
        id,
        code: args.code,
        title: args.title,
        credits: args.credits,
        semester: args.semester,
        grade: args.grade,
        status: args.status ?? 'planned',
        prerequisites: args.prerequisites ?? [],
        created_at: existing?.[1].created_at ?? now(),
        updated_at: now(),
      }
      await courses.put(id, record)
      return jsonValue({ ok: true, id, record, created: existing === undefined })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'trellis_degree_requirement_upsert',
    description: 'Upsert one graduation requirement bucket, e.g. Core Finance 30 credits.',
    parameters: {
      category: { type: 'string', required: true, description: 'Requirement category name.' },
      required_credits: { type: 'number', required: true, description: 'Total credits required.' },
      completed_credits: { type: 'number', description: 'Credits completed so far.' },
      notes: { type: 'string', description: 'Notes about the requirement.' },
    },
    output: {
      schema: { type: 'json' },
      render: jsonResult,
    },
    async execute(args): Promise<JsonValue> {
      const existing = [...requirements.entries()].find(([, record]) => record.category === args.category)
      const id = existing?.[0] ?? newId('req')
      const record: DegreeRequirementRecord = {
        id,
        category: args.category,
        required_credits: args.required_credits,
        completed_credits: args.completed_credits ?? existing?.[1].completed_credits ?? 0,
        notes: args.notes ?? existing?.[1].notes ?? '',
        created_at: existing?.[1].created_at ?? now(),
        updated_at: now(),
      }
      await requirements.put(id, record)
      return jsonValue({ ok: true, id, record })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'trellis_academic_plan_upsert',
    description: 'Upsert one term plan: a list of course ids plus an optional target GPA.',
    parameters: {
      term: { type: 'string', required: true, description: 'Term name, e.g. 2026 Fall.' },
      course_ids: { type: 'array', items: { type: 'string' }, description: 'Course record ids for this term.' },
      target_gpa: { type: 'number', description: 'Target GPA for the term.' },
      notes: { type: 'string', description: 'Planning notes.' },
    },
    output: {
      schema: { type: 'json' },
      render: jsonResult,
    },
    async execute(args): Promise<JsonValue> {
      const existing = [...plans.entries()].find(([, record]) => record.term === args.term)
      const id = existing?.[0] ?? newId('plan')
      const record: AcademicPlanRecord = {
        id,
        term: args.term,
        course_ids: args.course_ids ?? existing?.[1].course_ids ?? [],
        target_gpa: args.target_gpa ?? existing?.[1].target_gpa,
        notes: args.notes ?? existing?.[1].notes ?? '',
        created_at: existing?.[1].created_at ?? now(),
        updated_at: now(),
      }
      await plans.put(id, record)
      return jsonValue({ ok: true, id, record })
    },
  }))
}

function registerSourceAndCompetitionTools(
  ctx: Context,
  sources: KvTable<string, SourceRecord>,
  competitions: KvTable<string, CompetitionRecord>,
): void {
  ctx.tools.register(defineTool({
    name: 'trellis_source_register',
    description: 'Register a recurring information source to monitor, such as a bank career page, job board, or HUSD course catalog.',
    parameters: {
      name: { type: 'string', required: true, description: 'Source name.' },
      url: { type: 'string', required: true, description: 'Source URL.' },
      kind: { type: 'string', description: 'Source kind: website, job_board, school, competition.' },
      query: { type: 'string', description: 'Optional search query or selector hint.' },
      check_frequency: { type: 'string', description: 'daily, weekly, monthly.' },
    },
    output: {
      schema: { type: 'json' },
      render: jsonResult,
    },
    async execute(args): Promise<JsonValue> {
      const id = newId('source')
      const record: SourceRecord = {
        id,
        kind: args.kind ?? 'website',
        name: args.name,
        url: args.url,
        query: args.query,
        check_frequency: args.check_frequency ?? 'weekly',
        enabled: true,
        created_at: now(),
        updated_at: now(),
      }
      await sources.put(id, record)
      return jsonValue({ ok: true, id, record })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'trellis_competition_import',
    description: 'Save one competition, scholarship, or other opportunity into Trellis.',
    parameters: {
      name: { type: 'string', required: true, description: 'Competition or opportunity name.' },
      organizer: { type: 'string', description: 'Organizer name.' },
      url: { type: 'string', description: 'Official URL.' },
      deadline: { type: 'string', description: 'Deadline as ISO-8601 or free text.' },
      reward: { type: 'string', description: 'Prize or reward description.' },
      fit_score: { type: 'number', description: 'Personal fit score from 0 to 10.' },
      notes: { type: 'string', description: 'Notes.' },
    },
    output: {
      schema: { type: 'json' },
      render: jsonResult,
    },
    async execute(args): Promise<JsonValue> {
      const id = newId('competition')
      const record: CompetitionRecord = {
        id,
        name: args.name,
        organizer: args.organizer,
        url: args.url,
        deadline: args.deadline,
        reward: args.reward,
        fit_score: args.fit_score,
        notes: args.notes ?? '',
        created_at: now(),
        updated_at: now(),
      }
      await competitions.put(id, record)
      return jsonValue({ ok: true, id, record })
    },
  }))
}

function registerWorkbenchSearchTool(
  ctx: Context,
  jobs: KvTable<string, JobRecord>,
  contacts: KvTable<string, ContactRecord>,
  notes: KvTable<string, NoteRecord>,
  courses: KvTable<string, CourseRecord>,
  sources: KvTable<string, SourceRecord>,
  competitions: KvTable<string, CompetitionRecord>,
): void {
  ctx.tools.register(defineTool({
    name: 'trellis_workbench_search',
    description: 'Search legacy Trellis workbench records: jobs, contacts, notes, courses, monitored sources, and competitions. Use trellis_search for the source-backed knowledge graph.',
    parameters: {
      query: { type: 'string', required: true, description: 'Search text.' },
      kind: { type: 'string', description: 'Restrict to one kind: job, contact, note, course, source, competition.' },
    },
    output: {
      schema: { type: 'json' },
      render: jsonResult,
    },
    execute(args): Promise<JsonValue> {
      const q = args.query.toLowerCase()
      const matches: Array<{ kind: string; id: string; title: string }> = []

      const pushMatches = <T extends { id: string }>(
        kind: string,
        rows: Iterable<[string, T]>,
        titleOf: (record: T) => string,
        haystackOf: (record: T) => string,
      ): void => {
        if (args.kind !== undefined && args.kind !== kind) return
        for (const [id, record] of rows) {
          const title = titleOf(record)
          if (title.toLowerCase().includes(q) || haystackOf(record).toLowerCase().includes(q)) {
            matches.push({ kind, id, title })
          }
        }
      }

      pushMatches('job', jobs.entries(), r => `${r.title} @ ${r.company}`, r => r.description)
      pushMatches('contact', contacts.entries(), r => r.name, r => `${r.headline ?? ''} ${r.company ?? ''} ${r.notes}`)
      pushMatches('note', notes.entries(), r => r.title, r => `${r.content} ${r.tags.join(' ')} ${r.links.join(' ')}`)
      pushMatches('course', courses.entries(), r => `${r.code} ${r.title}`, r => `${r.semester ?? ''} ${r.prerequisites.join(' ')}`)
      pushMatches('source', sources.entries(), r => r.name, r => `${r.url} ${r.query ?? ''}`)
      pushMatches('competition', competitions.entries(), r => r.name, r => `${r.organizer ?? ''} ${r.notes}`)

      return Promise.resolve(jsonValue({ ok: true, query: args.query, matches }))
    },
  }))
}


interface TrellisTables {
  jobs: KvTable<string, JobRecord>
  contacts: KvTable<string, ContactRecord>
  applications: KvTable<string, ApplicationRecord>
  courses: KvTable<string, CourseRecord>
  requirements: KvTable<string, DegreeRequirementRecord>
  plans: KvTable<string, AcademicPlanRecord>
  notes: KvTable<string, NoteRecord>
  sources: KvTable<string, SourceRecord>
  competitions: KvTable<string, CompetitionRecord>
  knowledgeDocuments: KvTable<TrellisDocumentId, KnowledgeDocumentRecord>
}

function calculateDegreeProgress(requirements: KvTable<string, DegreeRequirementRecord>): {
  totalRequired: number
  totalCompleted: number
  remaining: number
} {
  const requirementRows = [...requirements.entries()].map(([, record]) => record)
  const totalRequired = requirementRows.reduce((sum, record) => sum + record.required_credits, 0)
  const totalCompleted = requirementRows.reduce((sum, record) => sum + record.completed_credits, 0)
  return { totalRequired, totalCompleted, remaining: Math.max(0, totalRequired - totalCompleted) }
}

function registerSummaryTool(
  ctx: Context,
  tables: TrellisTables,
  knowledge: TrellisKnowledge,
): void {
  ctx.tools.register(defineTool({
    name: 'trellis_summary',
    description: 'Return a compact summary of everything stored in Trellis: record counts, credit progress, and open applications.',
    parameters: {},
    output: {
      schema: { type: 'json' },
      render: jsonResult,
    },
    execute(): Promise<JsonValue> {
      const progress = calculateDegreeProgress(tables.requirements)
      const openApplications = [...tables.applications.entries()]
        .filter(([, record]) => record.status === 'draft' || record.status === 'applied' || record.status === 'interviewing')
        .length
      return Promise.resolve(jsonValue({
        ok: true,
        counts: {
          jobs: tables.jobs.size,
          contacts: tables.contacts.size,
          applications: tables.applications.size,
          courses: tables.courses.size,
          degree_requirements: tables.requirements.size,
          academic_plans: tables.plans.size,
          notes: tables.notes.size,
          sources: tables.sources.size,
          competitions: tables.competitions.size,
          knowledge_documents: knowledge.size,
        },
        credit_progress: {
          total_required: progress.totalRequired,
          total_completed: progress.totalCompleted,
          remaining: progress.remaining,
        },
        open_applications: openApplications,
      }))
    },
  }))
}

function registerLinkTool(ctx: Context, notes: KvTable<string, NoteRecord>): void {
  ctx.tools.register(defineTool({
    name: 'trellis_link_note',
    description: 'Add or replace links on an existing Trellis note. Links can be Trellis record ids or [[wikilinks]].',
    parameters: {
      note_id: { type: 'string', required: true, description: 'Trellis note id.' },
      links: { type: 'array', items: { type: 'string' }, required: true, description: 'Links to set or add.' },
      mode: { type: 'string', description: 'add or replace. Defaults to add.' },
    },
    output: {
      schema: { type: 'json' },
      render: jsonResult,
    },
    async execute(args): Promise<JsonValue> {
      const existing = notes.get(args.note_id)
      if (existing === undefined) {
        return jsonValue({ ok: false, error: 'note_not_found', note_id: args.note_id })
      }
      const mode = args.mode ?? 'add'
      const links = mode === 'replace' ? args.links : [...new Set([...existing.links, ...args.links])]
      const updated: NoteRecord = { ...existing, links, updated_at: now() }
      await notes.put(args.note_id, updated)
      return jsonValue({ ok: true, id: args.note_id, record: updated })
    },
  }))
}

function registerExportTool(
  ctx: Context,
  tables: TrellisTables,
): void {
  ctx.tools.register(defineTool({
    name: 'trellis_export',
    description: 'Export the whole Trellis knowledge base to JSON files and a Markdown index under .trellis-data/export. Use this to inspect or back up your data outside DSH.',
    parameters: {
      dir: { type: 'string', description: 'Optional export directory. Defaults to .trellis-data/export under the current working directory.' },
    },
    output: {
      schema: { type: 'json' },
      render: jsonResult,
    },
    async execute(args): Promise<JsonValue> {
      const dir = args.dir ?? join(process.cwd(), '.trellis-data', 'export')
      await mkdir(dir, { recursive: true })
      const dumpRows: Record<string, unknown[]> = {
        jobs: [...tables.jobs.entries()].map(([, record]) => record),
        contacts: [...tables.contacts.entries()].map(([, record]) => record),
        applications: [...tables.applications.entries()].map(([, record]) => record),
        courses: [...tables.courses.entries()].map(([, record]) => record),
        degree_requirements: [...tables.requirements.entries()].map(([, record]) => record),
        academic_plans: [...tables.plans.entries()].map(([, record]) => record),
        notes: [...tables.notes.entries()].map(([, record]) => record),
        sources: [...tables.sources.entries()].map(([, record]) => record),
        competitions: [...tables.competitions.entries()].map(([, record]) => record),
        knowledge_documents: [...tables.knowledgeDocuments.entries()].map(([, record]) => record),
      }
      const files: string[] = []
      for (const [name, rows] of Object.entries(dumpRows)) {
        const path = join(dir, `${name}.json`)
        await writeFile(path, JSON.stringify(rows, null, 2))
        files.push(path)
      }
      const summary = [
        '# Trellis Export',
        '',
        `Generated at ${now()}`,
        '',
        ...Object.entries(dumpRows).map(([name, rows]) => `- ${name}: ${rows.length}`),
        '',
      ].join('\n')
      const indexPath = join(dir, 'index.md')
      await writeFile(indexPath, summary)
      files.push(indexPath)
      return jsonValue({ ok: true, dir, files })
    },
  }))
}

function registerSkillGapTool(ctx: Context, courses: KvTable<string, CourseRecord>, notes: KvTable<string, NoteRecord>): void {
  ctx.tools.register(defineTool({
    name: 'trellis_skill_gap',
    description: 'Compare a list of target skills against your Trellis courses and notes. Returns which skills are covered and which are missing.',
    parameters: {
      skills: { type: 'array', items: { type: 'string' }, required: true, description: 'Target skills, e.g. ["financial modeling", "SQL"].' },
    },
    output: {
      schema: { type: 'json' },
      render: jsonResult,
    },
    execute(args): Promise<JsonValue> {
      const courseText = [...courses.entries()]
        .map(([, record]) => `${record.code} ${record.title} ${record.prerequisites.join(' ')}`.toLowerCase())
        .join('\n')
      const noteText = [...notes.entries()]
        .map(([, record]) => `${record.title} ${record.content} ${record.tags.join(' ')}`.toLowerCase())
        .join('\n')
      const haystack = `${courseText}\n${noteText}`
      const matched: Array<{ skill: string; evidence: string[] }> = []
      const missing: string[] = []
      for (const skill of args.skills) {
        const needle = skill.toLowerCase()
        const evidence: string[] = []
        for (const [, record] of courses.entries()) {
          const text = `${record.code} ${record.title} ${record.prerequisites.join(' ')}`.toLowerCase()
          if (text.includes(needle)) evidence.push(`${record.code} ${record.title}`)
        }
        for (const [, record] of notes.entries()) {
          const text = `${record.title} ${record.content} ${record.tags.join(' ')}`.toLowerCase()
          if (text.includes(needle)) evidence.push(`note: ${record.title}`)
        }
        if (evidence.length > 0) {
          matched.push({ skill, evidence: evidence.slice(0, 5) })
        } else {
          missing.push(skill)
        }
      }
      void haystack
      return Promise.resolve(jsonValue({ ok: true, matched, missing }))
    },
  }))
}

function registerGraduationForecastTool(
  ctx: Context,
  courses: KvTable<string, CourseRecord>,
  requirements: KvTable<string, DegreeRequirementRecord>,
  plans: KvTable<string, AcademicPlanRecord>,
): void {
  ctx.tools.register(defineTool({
    name: 'trellis_graduation_forecast',
    description: 'Estimate graduation progress and remaining terms from stored degree requirements and academic plans.',
    parameters: {},
    output: {
      schema: { type: 'json' },
      render: jsonResult,
    },
    execute(): Promise<JsonValue> {
      const progress = calculateDegreeProgress(requirements)
      const planRows = [...plans.entries()].map(([, record]) => record)
      const courseById = new Map([...courses.entries()].map(([id, record]) => [id, record]))
      const creditsByTerm = planRows.map(plan =>
        plan.course_ids.reduce((sum, id) => sum + (courseById.get(id)?.credits ?? 0), 0),
      )
      const plannedTerms = creditsByTerm.length
      const averageCreditsPerTerm = plannedTerms > 0
        ? creditsByTerm.reduce((sum, value) => sum + value, 0) / plannedTerms
        : 15
      const estimatedRemainingTerms = progress.remaining > 0 && averageCreditsPerTerm > 0
        ? Math.ceil(progress.remaining / averageCreditsPerTerm)
        : 0

      return Promise.resolve(jsonValue({
        ok: true,
        total_required: progress.totalRequired,
        total_completed: progress.totalCompleted,
        remaining_credits: progress.remaining,
        planned_terms: plannedTerms,
        average_credits_per_term: Number(averageCreditsPerTerm.toFixed(1)),
        estimated_remaining_terms: estimatedRemainingTerms,
      }))
    },
  }))
}


function registerPipelineTool(ctx: Context, tables: TrellisTables): void {
  ctx.tools.register(defineTool({
    name: 'trellis_pipeline',
    description: 'Show the application pipeline grouped by status: watching, applied, interviewing, offer, rejected.',
    parameters: {},
    output: {
      schema: { type: 'json' },
      render: jsonResult,
    },
    execute(): Promise<JsonValue> {
      const jobById = new Map([...tables.jobs.entries()].map(([id, record]) => [id, record]))
      const groups = new Map<string, Array<{ application_id: string; job_id: string; title: string; company: string; next_action: string }>>()
      for (const [id, record] of tables.applications.entries()) {
        const job = jobById.get(record.job_id)
        const status = record.status
        const item = {
          application_id: id,
          job_id: record.job_id,
          title: job?.title ?? 'Unknown job',
          company: job?.company ?? 'Unknown company',
          next_action: record.next_action,
        }
        const list = groups.get(status) ?? []
        list.push(item)
        groups.set(status, list)
      }
      const pipeline = [...groups.entries()].map(([status, items]) => ({ status, count: items.length, items }))
      return Promise.resolve(jsonValue({ ok: true, pipeline }))
    },
  }))
}

function registerDeadlinesTool(ctx: Context, tables: TrellisTables): void {
  ctx.tools.register(defineTool({
    name: 'trellis_deadlines',
    description: 'List upcoming deadlines from saved jobs and competitions. Deadlines are returned as stored; sort them by ISO date when possible.',
    parameters: {
      limit: { type: 'integer', description: 'Maximum number of deadlines to return.' },
    },
    output: {
      schema: { type: 'json' },
      render: jsonResult,
    },
    execute(args): Promise<JsonValue> {
      const items: Array<{ kind: string; id: string; title: string; deadline?: string }> = []
      for (const [id, record] of tables.jobs.entries()) {
        if (record.deadline !== undefined) items.push({ kind: 'job', id, title: `${record.title} @ ${record.company}`, deadline: record.deadline })
      }
      for (const [id, record] of tables.competitions.entries()) {
        if (record.deadline !== undefined) items.push({ kind: 'competition', id, title: record.name, deadline: record.deadline })
      }
      items.sort((a, b) => {
        if (a.deadline === undefined) return 1
        if (b.deadline === undefined) return -1
        return a.deadline.localeCompare(b.deadline)
      })
      const limited = args.limit === undefined ? items : items.slice(0, args.limit)
      return Promise.resolve(jsonValue({ ok: true, deadlines: limited }))
    },
  }))
}

function registerOutreachTool(ctx: Context, tables: TrellisTables): void {
  ctx.tools.register(defineTool({
    name: 'trellis_outreach_draft',
    description: 'Generate a template outreach message for a saved contact, optionally linked to a target job. This is a deterministic draft; the agent can personalize it.',
    parameters: {
      contact_id: { type: 'string', required: true, description: 'Trellis contact id.' },
      job_id: { type: 'string', description: 'Optional Trellis job id to reference in the message.' },
      tone: { type: 'string', description: 'professional or casual. Defaults to professional.' },
    },
    output: {
      schema: { type: 'json' },
      render: jsonResult,
    },
    execute(args): Promise<JsonValue> {
      const contact = tables.contacts.get(args.contact_id)
      if (contact === undefined) {
        return Promise.resolve(jsonValue({ ok: false, error: 'contact_not_found', contact_id: args.contact_id }))
      }
      const job = args.job_id === undefined ? undefined : tables.jobs.get(args.job_id)
      const firstName = contact.name.split(' ')[0] ?? contact.name
      const roleLine = job === undefined ? '' : ` I'm particularly interested in the ${job.title} role at ${job.company}.`
      const relationshipLine = contact.relationship === undefined || contact.relationship === ''
        ? ' I found your profile on LinkedIn and was impressed by your experience.'
        : ` We are connected through ${contact.relationship}.`
      const headlineLine = contact.headline === undefined || contact.headline === ''
        ? ''
        : ` I noticed your work as ${contact.headline}.`
      const tone = args.tone ?? 'professional'
      const closing = tone === 'casual' ? 'Would you be up for a quick chat?' : 'Would you be open to a 15-minute conversation?'
      const draft = `Hi ${firstName},${roleLine}${relationshipLine}${headlineLine}\n\n${closing}\n\nBest regards,\n[Your name]`
      return Promise.resolve(jsonValue({ ok: true, contact_id: contact.id, job_id: job?.id, draft }))
    },
  }))
}

function registerCourseRecommendTool(ctx: Context, tables: TrellisTables): void {
  ctx.tools.register(defineTool({
    name: 'trellis_course_recommend',
    description: 'Recommend courses from your catalog that best match a list of target skills or remaining degree requirements.',
    parameters: {
      skills: { type: 'array', items: { type: 'string' }, description: 'Target skills to match against course titles, tags, and prerequisites.' },
      max_results: { type: 'integer', description: 'Maximum number of recommendations.' },
    },
    output: {
      schema: { type: 'json' },
      render: jsonResult,
    },
    execute(args): Promise<JsonValue> {
      const skills = (args.skills ?? []).map(skill => skill.toLowerCase())
      const scored: Array<{ id: string; code: string; title: string; credits: number; score: number; reasons: string[] }> = []
      for (const [id, record] of tables.courses.entries()) {
        const haystack = `${record.code} ${record.title} ${record.prerequisites.join(' ')}`.toLowerCase()
        const reasons: string[] = []
        let score = 0
        for (const skill of skills) {
          if (haystack.includes(skill)) {
            score += 1
            reasons.push(skill)
          }
        }
        if (score > 0 || skills.length === 0) {
          scored.push({ id, code: record.code, title: record.title, credits: record.credits, score, reasons })
        }
      }
      scored.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code))
      const max = args.max_results ?? 10
      return Promise.resolve(jsonValue({ ok: true, recommendations: scored.slice(0, max) }))
    },
  }))
}

function registerAutoFileTool(ctx: Context, tables: TrellisTables): void {
  const inferKind = (title: string | undefined, url: string | undefined, content: string | undefined): string => {
    const text = `${title ?? ''} ${url ?? ''} ${content ?? ''}`.toLowerCase()
    if (url?.includes('linkedin.com/in/')) return 'contact'
    if (/(job|career|careers|vacancy|jd|responsibilities|requirements)/.test(text)) return 'job'
    if (/(course|syllabus|credits|prerequisite|semester|curriculum)/.test(text)) return 'course'
    if (/(competition|scholarship|deadline|prize|award)/.test(text)) return 'competition'
    return 'note'
  }

  ctx.tools.register(defineTool({
    name: 'trellis_auto_file',
    description: 'File raw pasted content or a URL into the right part of Trellis. It detects whether the content looks like a job, contact, course, competition, or general note, stores it in the matching table, and returns what it created.',
    parameters: {
      content: { type: 'string', description: 'Raw text to classify and store.' },
      url: { type: 'string', description: 'Source URL when archiving a link.' },
      title: { type: 'string', description: 'Optional title.' },
    },
    output: {
      schema: { type: 'json' },
      render: jsonResult,
    },
    async execute(args): Promise<JsonValue> {
      if (args.content === undefined && args.url === undefined) {
        return Promise.resolve(jsonValue({ ok: false, error: 'content_or_url_required' }))
      }
      const kind = inferKind(args.title, args.url, args.content)
      const nowIso = now()
      const noteId = newId('note')
      const note: NoteRecord = {
        id: noteId,
        title: args.title ?? args.url ?? 'Auto-filed content',
        content: args.content ?? '',
        kind,
        tags: [kind],
        links: [],
        source_url: args.url,
        created_at: nowIso,
        updated_at: nowIso,
      }
      await tables.notes.put(noteId, note)

      const created: string[] = ['note']
      if (kind === 'job') {
        const firstLine = (args.content ?? '').split('\n')[0]?.trim() ?? 'Untitled job'
        const companyMatch = /(?:at|@)\s+([A-Za-z0-9&.\- ]+)/i.exec(args.content ?? '')
        const jobId = newId('job')
        const job: JobRecord = {
          id: jobId,
          title: firstLine,
          company: companyMatch?.[1]?.trim() ?? 'Unknown company',
          url: args.url,
          description: args.content ?? '',
          status: 'watching',
          tags: ['auto-filed'],
          created_at: nowIso,
          updated_at: nowIso,
        }
        await tables.jobs.put(jobId, job)
        created.push('job')
      } else if (kind === 'contact' && args.url !== undefined) {
        const slug = args.url.split('/').filter(Boolean).pop() ?? 'Unknown'
        const contactId = newId('contact')
        const contact: ContactRecord = {
          id: contactId,
          name: slug.replace(/-/g, ' '),
          linkedin_url: args.url,
          notes: args.content ?? '',
          outreach_stage: 'not_contacted',
          created_at: nowIso,
          updated_at: nowIso,
        }
        await tables.contacts.put(contactId, contact)
        created.push('contact')
      } else if (kind === 'course') {
        const codeMatch = /[A-Za-z]{2,4}\s?\d{3,4}/.exec(args.content ?? '')
        const courseId = newId('course')
        const course: CourseRecord = {
          id: courseId,
          code: codeMatch?.[0]?.replace(/\s+/g, '') ?? 'UNKNOWN',
          title: args.title ?? (args.content ?? '').split('\n')[0]?.trim() ?? 'Untitled course',
          credits: 0,
          status: 'planned',
          prerequisites: [],
          created_at: nowIso,
          updated_at: nowIso,
        }
        await tables.courses.put(courseId, course)
        created.push('course')
      } else if (kind === 'competition') {
        const competitionId = newId('competition')
        const competition: CompetitionRecord = {
          id: competitionId,
          name: args.title ?? (args.content ?? '').split('\n')[0]?.trim() ?? 'Untitled competition',
          url: args.url,
          notes: args.content ?? '',
          created_at: nowIso,
          updated_at: nowIso,
        }
        await tables.competitions.put(competitionId, competition)
        created.push('competition')
      }

      return Promise.resolve(jsonValue({ ok: true, kind, note_id: noteId, created }))
    },
  }))
}

/**
 * Install the Trellis plugin: open the domain and register all model-facing
 * tools. The domain close is an effect, so unloading the plugin cleans up.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const domain: TrellisDomain = await ctx.storageDomain.open(trellisDomainSpec)
  ctx.effect(() => () => domain.close(), 'trellis.domainClose')

  const tables: TrellisTables = {
    jobs: domain.table('jobs'),
    contacts: domain.table('contacts'),
    applications: domain.table('applications'),
    notes: domain.table('notes'),
    courses: domain.table('courses'),
    requirements: domain.table('degree_requirements'),
    plans: domain.table('academic_plans'),
    sources: domain.table('sources'),
    competitions: domain.table('competitions'),
    knowledgeDocuments: domain.table('knowledge_documents'),
  }
  const knowledgeConfig: TrellisKnowledgeConfig = {
    maxContentChars: config.maxContentChars,
    maxReadChars: config.maxReadChars,
    maxSearchResults: config.maxSearchResults,
    maxSnippetChars: config.maxSnippetChars,
    maxGraphNodes: config.maxGraphNodes,
    maxRelationsPerDocument: config.maxRelationsPerDocument,
  }
  const knowledge = new TrellisKnowledge(tables.knowledgeDocuments, ctx.web, knowledgeConfig)
  ctx.provide('trellisKnowledge', knowledge)
  ctx.systemPrompt.section({
    name: 'tool:trellis',
    order: 116,
    text: 'Trellis is the user\'s durable personal knowledge base. Treat a standalone HTTP(S) link, a [Trellis document] block, an uploaded or @-referenced file, or an explicit archive request with no other task as a request to collect and organize it. For uploaded files, read them first with read_document, then call trellis_ingest with the extracted content, file_name, and media_type. For URLs, call trellis_ingest with the URL so Trellis fetches and retains provenance. For pasted content, call trellis_ingest with the content and a pasted source. Before every ingest, use trellis_search to find likely related documents. Write a grounded summary and normalized tags, and add only relations supported by explicit evidence. Never invent relation targets: use ids returned by Trellis. Use trellis_read for full context, trellis_connect for later links, and trellis_graph when the user wants to browse or visualize the knowledge base. Confirm what was archived by id and title, and never claim content was archived until the tool succeeds.',
  })
  registerKnowledgeTools(ctx, knowledge, config.fetchTimeoutMs)

  registerJobTools(ctx, tables.jobs)
  registerContactTools(ctx, tables.contacts)
  registerApplicationTools(ctx, tables.applications)
  registerNoteTools(ctx, tables.notes)
  registerCourseTools(ctx, tables.courses, tables.requirements, tables.plans)
  registerSourceAndCompetitionTools(ctx, tables.sources, tables.competitions)
  registerWorkbenchSearchTool(ctx, tables.jobs, tables.contacts, tables.notes, tables.courses, tables.sources, tables.competitions)
  registerSummaryTool(ctx, tables, knowledge)
  registerLinkTool(ctx, tables.notes)
  registerExportTool(ctx, tables)
  registerSkillGapTool(ctx, tables.courses, tables.notes)
  registerGraduationForecastTool(ctx, tables.courses, tables.requirements, tables.plans)
  registerPipelineTool(ctx, tables)
  registerDeadlinesTool(ctx, tables)
  registerOutreachTool(ctx, tables)
  registerCourseRecommendTool(ctx, tables)
  registerAutoFileTool(ctx, tables)

  ctx.inject(['workspaceRegistry'], (innerCtx) => {
    const wsReg = (innerCtx as unknown as {
      workspaceRegistry: {
        list(): readonly { id: string }[]
        create(p: string, t?: string): Promise<unknown>
      }
    }).workspaceRegistry
    innerCtx.effect(() => {
      void (async () => {
        try {
          if (wsReg.list().length === 0) {
            const home = process.env.DSH_HOME ?? '.'
            const notesDir = join(home, 'notes')
            await mkdir(notesDir, { recursive: true })
            await wsReg.create(notesDir, '我的个人知识库')
          }
        } catch {
          // ignore already created
        }
      })()
      return () => {}
    }, 'trellis: ensure default workspace')
  })

  ctx.inject(['webServer'], (innerCtx) => {
    const webServer = (innerCtx as unknown as { webServer: { register(r: unknown): () => void } }).webServer
    innerCtx.effect(() => webServer.register({
      kind: 'prefix',
      path: '/api/trellis',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        const parsed = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
        if (parsed.pathname === '/api/trellis/knowledge') {
          const docs = knowledge.listAll()
          const graphData = knowledge.graph({ limit: 500 })
          const allTags = [...new Set(docs.flatMap(d => d.tags))]
          const body = JSON.stringify({
            ok: true,
            stats: {
              totalDocuments: docs.length,
              totalRelations: graphData.edges.length,
              totalTags: allTags.length,
            },
            documents: docs.map(d => ({
              id: d.id,
              title: d.title,
              summary: d.summary,
              kind: d.kind,
              tags: d.tags,
              source: d.source,
              createdAt: d.createdAt,
              updatedAt: d.updatedAt,
              relationsCount: d.relations.length,
              wordCount: d.content.length,
            })),
            graph: graphData,
          })
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(body)
          return
        }
        if (parsed.pathname === '/api/trellis/document') {
          const id = parsed.searchParams.get('id')
          if (!id) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: 'Missing document id' }))
            return
          }
          try {
            const read = knowledge.read(id as TrellisDocumentId)
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ ok: true, data: read }))
          } catch (error) {
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: String(error) }))
          }
          return
        }
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'Not found' }))
      },
    }), 'trellis: /api/trellis route')

    innerCtx.effect(() => webServer.register({
      kind: 'exact',
      path: '/trellis/canvas',
      handler: (_req: IncomingMessage, res: ServerResponse): void => {
        const html = [
          '<!doctype html>',
          '<html lang="en"><head><meta charset="utf-8"><title>Trellis Canvas</title>',
          '<style>',
          'body{margin:0;background:#0f1a14;color:#e8f5ee;font-family:ui-sans-serif,system-ui,sans-serif}',
          'header{padding:16px 24px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;gap:12px;align-items:center}',
          'h1{font-size:18px;margin:0}',
          'svg{width:100vw;height:calc(100vh - 60px);display:block}',
          '.node{fill:#1e7a58;stroke:#4ad096;stroke-width:1.5;cursor:pointer}',
          '.node:hover{fill:#2ea878}',
          '.edge{stroke:rgba(255,255,255,.25);stroke-width:1}',
          '.label{fill:#e8f5ee;font-size:10px;pointer-events:none}',
          '</style></head><body>',
          '<header><h1>Trellis Knowledge Canvas</h1><span id="stats"></span></header>',
          '<svg id="graph"></svg>',
          '<script>',
          'fetch("/api/trellis/knowledge").then(r=>r.json()).then(data=>{',
          'const nodes=data.graph.nodes,edges=data.graph.edges;',
          'document.getElementById("stats").textContent=`${nodes.length} nodes · ${edges.length} edges`;',
          'const svg=document.getElementById("graph");',
          'const NS="http://www.w3.org/2000/svg";',
          'const cx=innerWidth/2,cy=innerHeight/2;',
          'const angle=2*Math.PI/nodes.length;',
          'const pos=new Map();',
          'nodes.forEach((n,i)=>{const r=Math.min(innerWidth,innerHeight)*0.35;const x=cx+r*Math.cos(angle*i);const y=cy+r*Math.sin(angle*i);pos.set(n.id,{x,y});});',
          'edges.forEach(e=>{const a=pos.get(e.source),b=pos.get(e.target);if(!a||!b)return;const line=document.createElementNS(NS,"line");line.setAttribute("x1",a.x);line.setAttribute("y1",a.y);line.setAttribute("x2",b.x);line.setAttribute("y2",b.y);line.setAttribute("class","edge");svg.appendChild(line);});',
          'nodes.forEach(n=>{const p=pos.get(n.id);if(!p)return;const g=document.createElementNS(NS,"g");g.setAttribute("transform",`translate(${p.x},${p.y})`);const c=document.createElementNS(NS,"circle");c.setAttribute("r",8);c.setAttribute("class","node");c.addEventListener("click",()=>{fetch(`/api/trellis/document?id=${encodeURIComponent(n.id)}`).then(r=>r.json()).then(d=>{alert(d.data.title+"\\n\\n"+(d.data.summary||""));});});g.appendChild(c);const t=document.createElementNS(NS,"text");t.setAttribute("class","label");t.setAttribute("y",-12);t.setAttribute("text-anchor","middle");t.textContent=n.title.length>24?n.title.slice(0,24)+"…":n.title;g.appendChild(t);svg.appendChild(g);});',
          '}).catch(e=>document.getElementById("stats").textContent="Failed to load: "+e);',
          '</script></body></html>',
        ].join('\n')
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(html)
      },
    }), 'trellis: /trellis/canvas route')

    innerCtx.effect(() => webServer.register({
      kind: 'exact',
      path: '/trellis',
      handler: (_req: IncomingMessage, res: ServerResponse): void => {
        const html = [
          '<!doctype html>',
          '<html lang="en"><head><meta charset="utf-8"><title>Trellis Home</title>',
          '<style>',
          'body{margin:0;background:linear-gradient(135deg,#0f1a14,#10281f);color:#e8f5ee;font-family:ui-sans-serif,system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center}',
          '.card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:48px;max-width:520px;text-align:center}',
          'h1{font-size:32px;margin:0 0 8px}',
          'p{color:#9fc9b4;margin:0 0 32px}',
          'a{display:block;background:#1e7a58;color:#fff;text-decoration:none;padding:14px 20px;border-radius:12px;margin:10px 0;font-weight:600}',
          'a:hover{background:#2ea878}',
          '</style></head><body>',
          '<div class="card"><h1>Trellis</h1><p>Your academic + career workbench</p>',
          '<a href="/">💬 Chat with Agent</a>',
          '<a href="/trellis/canvas">🕸 Knowledge Canvas</a>',
          '</div></body></html>',
        ].join('\n')
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(html)
      },
    }), 'trellis: /trellis home route')
  })
}
