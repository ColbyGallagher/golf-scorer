'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchAllCourses, updateScorecard } from '../../lib/db';
import type { SavedCourse, TeeHole } from '../../lib/db';

const TEE_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  yellow: { bg: 'rgba(255,215,0,0.18)',   border: 'rgba(255,215,0,0.6)',    color: '#ffe566' },
  white:  { bg: 'rgba(255,255,255,0.12)', border: 'rgba(255,255,255,0.5)',  color: '#f5f0e8' },
  red:    { bg: 'rgba(224,85,85,0.15)',   border: 'rgba(224,85,85,0.5)',    color: '#e05555' },
  blue:   { bg: 'rgba(85,153,204,0.15)',  border: 'rgba(85,153,204,0.5)',   color: '#88bbee' },
  black:  { bg: 'rgba(30,30,30,0.5)',     border: 'rgba(180,180,180,0.4)',  color: '#d0ccc6' },
};

function teeBadgeStyle(tee: string, active: boolean) {
  const s = TEE_STYLES[tee] || { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.25)', color: 'var(--cream)' };
  return {
    padding: '5px 13px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    background: active ? s.border : s.bg,
    border: `2px solid ${active ? s.color : s.border}`,
    color: active ? '#111' : s.color,
  };
}

function formatDate(d: string) {
  const dt = new Date(d);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

interface EditState {
  course: SavedCourse;
  name: string;
  tees: Record<string, TeeHole[]>;
  activeTee: string;
}

function HoleEditor({
  holes,
  onParChange,
  onIdxChange,
}: {
  holes: TeeHole[];
  onParChange: (h: number, v: number) => void;
  onIdxChange: (h: number, v: number) => void;
}) {
  const frontPar = holes.slice(0, 9).reduce((a, b) => a + b.par, 0);
  const backPar  = holes.slice(9).reduce((a, b) => a + b.par, 0);

  return (
    <table className="course-table" style={{ width: '100%' }}>
      <thead>
        <tr>
          <th>H</th><th>Par</th><th>SI</th>
          <th style={{ width: 8, borderLeft: '1px solid rgba(245,240,232,0.06)' }} />
          <th>H</th><th>Par</th><th>SI</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 9 }, (_, i) => (
          <tr key={i}>
            <td style={{ color: 'var(--gold)', fontWeight: 600 }}>{i + 1}</td>
            <td>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                <button className="ct-par-btn" onClick={() => onParChange(i, Math.max(3, holes[i].par - 1))}>−</button>
                <span style={{ minWidth: 18, textAlign: 'center', fontWeight: 600, color: 'var(--cream)' }}>{holes[i].par}</span>
                <button className="ct-par-btn" onClick={() => onParChange(i, Math.min(5, holes[i].par + 1))}>+</button>
              </div>
            </td>
            <td>
              <input
                className="ct-idx-input"
                type="number"
                inputMode="numeric"
                min={1} max={18}
                value={holes[i].index}
                onChange={e => onIdxChange(i, parseInt(e.target.value) || holes[i].index)}
              />
            </td>
            <td style={{ borderLeft: '1px solid rgba(245,240,232,0.06)' }} />
            <td style={{ color: 'var(--gold)', fontWeight: 600 }}>{i + 10}</td>
            <td>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                <button className="ct-par-btn" onClick={() => onParChange(i + 9, Math.max(3, holes[i + 9].par - 1))}>−</button>
                <span style={{ minWidth: 18, textAlign: 'center', fontWeight: 600, color: 'var(--cream)' }}>{holes[i + 9].par}</span>
                <button className="ct-par-btn" onClick={() => onParChange(i + 9, Math.min(5, holes[i + 9].par + 1))}>+</button>
              </div>
            </td>
            <td>
              <input
                className="ct-idx-input"
                type="number"
                inputMode="numeric"
                min={1} max={18}
                value={holes[i + 9].index}
                onChange={e => onIdxChange(i + 9, parseInt(e.target.value) || holes[i + 9].index)}
              />
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr style={{ fontSize: 10, borderTop: '1px solid rgba(245,240,232,0.1)' }}>
          <td colSpan={2} style={{ padding: '5px 3px', textAlign: 'right', color: 'rgba(245,240,232,0.35)' }}>Front</td>
          <td style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 700 }}>{frontPar}</td>
          <td />
          <td colSpan={2} style={{ padding: '5px 3px', textAlign: 'right', color: 'rgba(245,240,232,0.35)' }}>Back</td>
          <td style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 700 }}>{backPar}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function CourseEditOverlay({
  edit,
  onClose,
  onSaved,
}: {
  edit: EditState;
  onClose: () => void;
  onSaved: (updated: SavedCourse) => void;
}) {
  const [name,      setName]      = useState(edit.name);
  const [tees,      setTees]      = useState<Record<string, TeeHole[]>>(
    JSON.parse(JSON.stringify(edit.tees))
  );
  const [activeTee, setActiveTee] = useState(edit.activeTee);
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState('');

  const teeNames = Object.keys(tees);

  function setHolePar(h: number, v: number) {
    setTees(prev => {
      const next = { ...prev, [activeTee]: prev[activeTee].map((hole, i) => i === h ? { ...hole, par: v } : hole) };
      return next;
    });
  }

  function setHoleIdx(h: number, v: number) {
    setTees(prev => {
      const next = { ...prev, [activeTee]: prev[activeTee].map((hole, i) => i === h ? { ...hole, index: v, indices: [v, ...(hole.indices?.slice(1) ?? [])] } : hole) };
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setMsg('');
    const result = await updateScorecard(edit.course.id, name.trim() || edit.course.course_name, tees);
    setSaving(false);
    if (result === 'saved') {
      setMsg('✅ Saved');
      onSaved({ ...edit.course, course_name: name.trim() || edit.course.course_name, tees });
      setTimeout(onClose, 800);
    } else {
      setMsg('⚠️ Save failed');
    }
  }

  const holes = tees[activeTee] ?? [];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--green-deep)', overflowY: 'auto', zIndex: 100 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '12px 14px 40px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--cream)', fontSize: 18, cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}>←</button>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: 'var(--gold)' }}>Edit Course</div>
        </div>

        {/* Course name */}
        <div className="card">
          <div className="card-title">📋 Course Name</div>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              width: '100%', padding: '8px 11px', boxSizing: 'border-box',
              background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(201,168,76,0.25)',
              borderRadius: 8, color: 'var(--cream)',
              fontFamily: "'DM Sans', sans-serif", fontSize: 14, outline: 'none',
            }}
          />
        </div>

        {/* Tee hole editor */}
        <div className="card">
          <div className="card-title">🏌️ Hole Data</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {teeNames.map(t => (
              <button key={t} style={teeBadgeStyle(t, t === activeTee)} onClick={() => setActiveTee(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {holes.length === 18 ? (
            <HoleEditor
              holes={holes}
              onParChange={setHolePar}
              onIdxChange={setHoleIdx}
            />
          ) : (
            <div className="empty-state">No hole data for this tee</div>
          )}
        </div>

        {/* Note about historical rounds */}
        <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.3)', marginBottom: 14, textAlign: 'center' }}>
          Changes apply to future rounds only — previously saved rounds keep their original hole data.
        </div>

        {msg && (
          <div style={{
            padding: '8px 11px', marginBottom: 10, borderRadius: 8, fontSize: 12, textAlign: 'center',
            background: msg.startsWith('✅') ? 'rgba(78,186,122,0.12)' : 'rgba(224,85,85,0.1)',
            color: msg.startsWith('✅') ? 'var(--green-bright)' : 'var(--red)',
            border: `1px solid ${msg.startsWith('✅') ? 'rgba(78,186,122,0.25)' : 'rgba(224,85,85,0.3)'}`,
          }}>
            {msg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn-primary" style={{ flex: 2, marginBottom: 0 }} onClick={handleSave} disabled={saving}>
            {saving ? '⏳ Saving…' : '💾 Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<SavedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);

  useEffect(() => {
    fetchAllCourses().then(c => { setCourses(c); setLoading(false); });
  }, []);

  function openEdit(course: SavedCourse) {
    const teeNames = Object.keys(course.tees || {});
    setEditing({
      course,
      name: course.course_name,
      tees: course.tees,
      activeTee: teeNames[0] ?? '',
    });
  }

  function handleSaved(updated: SavedCourse) {
    setCourses(prev => prev.map(c => c.id === updated.id ? updated : c));
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 0', maxWidth: 480, margin: '0 auto' }}>
        <Link href="/setup" style={{ color: 'var(--gold)', fontSize: 18, textDecoration: 'none', lineHeight: 1 }}>←</Link>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: 'var(--gold)', margin: 0 }}>Courses</h1>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '14px 14px 40px' }}>
        {loading ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>⏳ Loading…</div>
        ) : courses.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            No courses in the library yet.<br />Scan a scorecard on the New Round page.
          </div>
        ) : (
          courses.map(c => {
            const teeNames = Object.keys(c.tees || {});
            return (
              <div
                key={c.id}
                className="card"
                onClick={() => openEdit(c)}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{c.course_name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)', marginTop: 3 }}>
                      {formatDate(c.scanned_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {teeNames.map(t => {
                      const s = TEE_STYLES[t] || { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.2)', color: 'var(--cream)' };
                      return (
                        <span key={t} style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5,
                          background: s.bg, border: `1px solid ${s.border}`, color: s.color,
                        }}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </span>
                      );
                    })}
                  </div>
                  <span style={{ color: 'rgba(245,240,232,0.25)', fontSize: 15, marginLeft: 4 }}>›</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {editing && (
        <CourseEditOverlay
          edit={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
