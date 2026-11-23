import type { ContentSection, Source } from "@/data/content";

// 소제목·문단·표를 차례로 그립니다. 표는 좁은 화면에서 옆으로 밀어 볼 수 있게 감쌉니다.
export function ContentSections({ sections }: { sections: ContentSection[] }) {
  return (
    <>
      {sections.map((s) => (
        <section key={s.heading}>
          <h2>{s.heading}</h2>
          {s.body.map((para, i) => <p key={i}>{para}</p>)}
          {s.table && (
            <figure className="data-table">
              <div className="scroll">
                <table>
                  <caption>{s.table.caption}</caption>
                  <thead>
                    <tr>{s.table.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {s.table.rows.map((row, i) => (
                      <tr key={i}>{row.map((cell, j) => (j === 0 ? <th key={j} scope="row">{cell}</th> : <td key={j}>{cell}</td>))}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {s.table.note && <figcaption className="note-sm">{s.table.note}</figcaption>}
            </figure>
          )}
          {s.after?.map((para, i) => <p key={`a${i}`}>{para}</p>)}
        </section>
      ))}
    </>
  );
}

// 참고한 자료 목록. 바깥 사이트라 새 창으로 엽니다.
export function SourceList({ sources, checked }: { sources: Source[]; checked?: string }) {
  if (sources.length === 0) return null;
  return (
    <section className="sources">
      <h2>참고한 자료</h2>
      <ul>
        {sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>
          </li>
        ))}
      </ul>
      {checked && <p className="note-sm">자료 확인일: {checked.replaceAll("-", ".")}</p>}
    </section>
  );
}
