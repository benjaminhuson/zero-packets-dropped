import { ORG_CHAIN, WORKING_WITH, type Person } from '../data';

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function PersonCard({ person, highlight }: { person: Person; highlight?: boolean }) {
  return (
    <div className={`person-card${highlight ? ' is-you' : ''}`}>
      <div className="avatar" aria-hidden="true">
        {person.name === 'Charlie' ? 'C' : initials(person.name)}
      </div>
      <div>
        <p className="person-name">{person.name}</p>
        <p className="person-role">{person.role}</p>
        {person.note && <p className="person-note">{person.note}</p>}
      </div>
    </div>
  );
}

export function OrgChart() {
  // ORG_CHAIN runs from you (index 0) up to the top (last item). Display top-down.
  const top = [...ORG_CHAIN].reverse();

  return (
    <div className="orgchart">
      <h3 className="section-title">Reporting line</h3>
      <ol className="chain" aria-label="Reporting line, from the top down">
        {top.map((person, i) => (
          <li key={person.id} className={person.id === 'you' ? 'chain-you' : undefined}>
            <PersonCard person={person} highlight={person.id === 'you'} />
            {i < top.length - 1 && <span className="connector" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      <h3 className="section-title">Working with</h3>
      <div className="working-grid">
        {WORKING_WITH.map((p) => (
          <PersonCard key={p.id} person={p} />
        ))}
      </div>
    </div>
  );
}
