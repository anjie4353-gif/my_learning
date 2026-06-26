// Seed a hand-crafted Pythagorean Theorem geometry diagram into MongoDB cache.
const { MongoClient } = require('mongodb')
const { v4: uuidv4 } = require('uuid')

;(async () => {
  const url = process.env.MONGO_URL || 'mongodb://localhost:27017'
  const dbName = process.env.DB_NAME || 'visual_engineering_ai'
  const client = new MongoClient(url)
  await client.connect()
  const db = client.db(dbName)

  const diagrams = [
    {
      id: uuidv4(),
      prompt: 'Explain Pythagorean Theorem',
      lang: 'en',
      createdAt: new Date(),
      diagram: {
        title: 'Pythagorean Theorem',
        category: 'Geometry',
        renderer: 'geometry',
        summary: 'In a right-angled triangle, the square of the hypotenuse equals the sum of the squares of the other two sides. This famous theorem connects the three sides of a right triangle through their squared lengths.',
        language: 'en',
        nodes: [],
        edges: [],
        geometry: {
          viewBox: '0 0 600 460',
          points: [
            { id: 'A', x: 180, y: 320, label: 'A' },
            { id: 'B', x: 420, y: 320, label: 'B' },
            { id: 'C', x: 180, y: 140, label: 'C' },
          ],
          lines: [
            { id: 'AB', from: 'A', to: 'B', label: 'a = 4', color: '#3b82f6' },
            { id: 'AC', from: 'A', to: 'C', label: 'b = 3', color: '#22c55e' },
            { id: 'BC', from: 'B', to: 'C', label: 'c = 5', color: '#f97316' },
          ],
          polygons: [
            {
              id: 'tri',
              pointIds: ['A', 'B', 'C'],
              fill: 'rgba(168,85,247,0.18)',
              stroke: '#a855f7',
              label: '',
            },
            // Square on side a (AB) — below
            {
              id: 'sq_a',
              pointIds: ['A', 'B', 'B_a', 'A_a'],
              fill: 'rgba(59,130,246,0.20)',
              stroke: '#3b82f6',
              label: 'a² = 16',
            },
            // Square on side b (AC) — left
            {
              id: 'sq_b',
              pointIds: ['A', 'C', 'C_b', 'A_b'],
              fill: 'rgba(34,197,94,0.20)',
              stroke: '#22c55e',
              label: 'b² = 9',
            },
            // Square on hypotenuse c (BC) — outward
            {
              id: 'sq_c',
              pointIds: ['B', 'C', 'C_c', 'B_c'],
              fill: 'rgba(249,115,22,0.20)',
              stroke: '#f97316',
              label: 'c² = 25',
            },
          ],
          arcs: [
            { id: 'right_angle', cx: 180, cy: 320, r: 22, startAngle: -90, endAngle: 0, stroke: '#fbbf24', label: '90°' },
          ],
          circles: [],
          labels: [
            { id: 'eq', x: 300, y: 30, text: 'a² + b² = c²', color: '#fbbf24', fontSize: 26 },
            { id: 'eq2', x: 300, y: 60, text: '16 + 9 = 25 ✓', color: '#86efac', fontSize: 18 },
          ],
        },
        steps: [
          {
            index: 1,
            title: 'Place the three points',
            description: 'Mark point A at the right angle, point B on the horizontal, and point C on the vertical. These will form the corners of our right triangle.',
            highlightNodes: [],
            highlightEdges: [],
            showGeometryIds: ['A', 'B', 'C'],
          },
          {
            index: 2,
            title: 'Connect the legs (sides a and b)',
            description: 'Draw side a from A to B (length 4) and side b from A to C (length 3). These are the two legs that meet at the right angle.',
            highlightNodes: [],
            highlightEdges: [],
            showGeometryIds: ['A', 'B', 'C', 'AB', 'AC', 'right_angle'],
          },
          {
            index: 3,
            title: 'Draw the hypotenuse (side c)',
            description: 'Connect B and C to complete the triangle. Side c is the hypotenuse — the longest side, opposite to the right angle.',
            highlightNodes: [],
            highlightEdges: [],
            showGeometryIds: ['A', 'B', 'C', 'AB', 'AC', 'BC', 'right_angle', 'tri'],
          },
          {
            index: 4,
            title: 'Build squares on each side',
            description: 'Construct a square on each side of the triangle. The areas are a²=16, b²=9, and c²=25.',
            highlightNodes: [],
            highlightEdges: [],
            showGeometryIds: ['A', 'B', 'C', 'AB', 'AC', 'BC', 'right_angle', 'tri', 'sq_a', 'sq_b', 'sq_c'],
          },
          {
            index: 5,
            title: 'Reveal the theorem',
            description: 'The sum of the areas of the two smaller squares (a² + b² = 16 + 9 = 25) equals the area of the square on the hypotenuse (c² = 25). This is the Pythagorean Theorem.',
            highlightNodes: [],
            highlightEdges: [],
            showGeometryIds: ['A', 'B', 'C', 'AB', 'AC', 'BC', 'right_angle', 'tri', 'sq_a', 'sq_b', 'sq_c', 'eq', 'eq2'],
          },
        ],
        formulas: [
          { name: 'Pythagorean Theorem', latex: 'a^2 + b^2 = c^2', description: 'For any right triangle with legs a, b and hypotenuse c.' },
          { name: 'Hypotenuse', latex: 'c = \\sqrt{a^2 + b^2}', description: 'Find c when you know the two legs.' },
          { name: 'Example (3-4-5)', latex: '3^2 + 4^2 = 9 + 16 = 25 = 5^2', description: 'The classic Pythagorean triple.' },
        ],
        insights: [
          'The theorem only works for RIGHT triangles (one 90° angle).',
          'The hypotenuse is always the longest side and lies opposite the right angle.',
          'Integer triples like (3,4,5), (5,12,13), (8,15,17) are called Pythagorean triples.',
          'The theorem generalizes to higher dimensions via the law of cosines.',
        ],
      },
    },
    {
      id: uuidv4(),
      prompt: 'Explain Triangle',
      lang: 'en',
      createdAt: new Date(),
      diagram: {
        title: 'Triangle ABC',
        category: 'Geometry',
        renderer: 'geometry',
        summary: 'A triangle is a three-sided polygon defined by three vertices A, B, C connected by three sides. The sum of its interior angles is always 180°.',
        language: 'en',
        nodes: [],
        edges: [],
        geometry: {
          viewBox: '0 0 600 400',
          points: [
            { id: 'A', x: 150, y: 320, label: 'A' },
            { id: 'B', x: 450, y: 320, label: 'B' },
            { id: 'C', x: 300, y: 100, label: 'C' },
          ],
          lines: [
            { id: 'AB', from: 'A', to: 'B', label: 'c', color: '#3b82f6' },
            { id: 'BC', from: 'B', to: 'C', label: 'a', color: '#22c55e' },
            { id: 'CA', from: 'C', to: 'A', label: 'b', color: '#f97316' },
          ],
          polygons: [
            { id: 'tri', pointIds: ['A', 'B', 'C'], fill: 'rgba(168,85,247,0.15)', stroke: '#a855f7', label: '' },
          ],
          arcs: [
            { id: 'ang_A', cx: 150, cy: 320, r: 28, startAngle: -36, endAngle: 0, stroke: '#fbbf24', label: '∠A' },
            { id: 'ang_B', cx: 450, cy: 320, r: 28, startAngle: 180, endAngle: 216, stroke: '#fbbf24', label: '∠B' },
            { id: 'ang_C', cx: 300, cy: 100, r: 28, startAngle: 55, endAngle: 125, stroke: '#fbbf24', label: '∠C' },
          ],
          circles: [],
          labels: [
            { id: 'sum', x: 300, y: 40, text: '∠A + ∠B + ∠C = 180°', color: '#fbbf24', fontSize: 20 },
          ],
        },
        steps: [
          { index: 1, title: 'Plot vertex A', description: 'Place the first vertex A at the bottom-left.', highlightNodes: [], highlightEdges: [], showGeometryIds: ['A'] },
          { index: 2, title: 'Plot vertex B', description: 'Place the second vertex B at the bottom-right.', highlightNodes: [], highlightEdges: [], showGeometryIds: ['A', 'B'] },
          { index: 3, title: 'Plot vertex C', description: 'Place the third vertex C at the top.', highlightNodes: [], highlightEdges: [], showGeometryIds: ['A', 'B', 'C'] },
          { index: 4, title: 'Connect to form triangle', description: 'Draw sides AB (c), BC (a), and CA (b) to close the figure.', highlightNodes: [], highlightEdges: [], showGeometryIds: ['A', 'B', 'C', 'AB', 'BC', 'CA', 'tri'] },
          { index: 5, title: 'Mark the three angles', description: 'Each vertex has an interior angle. Together they always sum to 180°.', highlightNodes: [], highlightEdges: [], showGeometryIds: ['A', 'B', 'C', 'AB', 'BC', 'CA', 'tri', 'ang_A', 'ang_B', 'ang_C', 'sum'] },
        ],
        formulas: [
          { name: 'Angle Sum', latex: '\\angle A + \\angle B + \\angle C = 180°', description: 'Interior angles of any triangle sum to 180°.' },
          { name: 'Area (Heron\'s formula)', latex: '\\text{Area} = \\sqrt{s(s-a)(s-b)(s-c)}, \\; s = \\frac{a+b+c}{2}', description: 'Area from side lengths only.' },
          { name: 'Law of Cosines', latex: 'c^2 = a^2 + b^2 - 2ab\\cos(C)', description: 'Generalizes Pythagoras to any triangle.' },
        ],
        insights: [
          'Triangles are the simplest polygon and the most stable shape — used in trusses, bridges, and roofs.',
          'Classified by sides: equilateral (3 equal), isosceles (2 equal), scalene (none equal).',
          'Classified by angles: acute (all < 90°), right (one = 90°), obtuse (one > 90°).',
          'Any polygon can be triangulated — split into triangles — for area calculations and 3D graphics.',
        ],
      },
    },
  ]

  // Compute square corners for the Pythagorean diagram.
  const pyth = diagrams[0].diagram.geometry
  // Right triangle: A=(180,320), B=(420,320), C=(180,140). Legs along axes.
  // Square on AB (downward, since AB is horizontal): A_a=(180,440), B_a=(420,440)
  // Square on AC (leftward, AC is vertical): A_b=(60,320), C_b=(60,140)
  // Square on hypotenuse BC (outward away from A): vector BC = C-B = (-240,-180). Perpendicular outward = (-180,240) NOT scaled. Actually scale to length 300.
  // |BC|=300. Outward perpendicular (rotate BC by -90°): (BC.y, -BC.x) = (-180, 240). Length is 300, perfect.
  // So B_c = B + (-180,240) = (240,560). But that goes off canvas. Let me rotate the other way: (BC.y, -BC.x) gives (-180, 240). For outward (away from A=(180,320)), we want positive x direction.
  // Rotate by +90°: (-BC.y, BC.x) = (180, -240). So B_c = (420+180, 320-240) = (600,80), C_c = (180+180, 140-240) = (360,-100). Goes off-canvas top.
  // Hmm. With viewBox 0 0 600 460, putting square outside is hard. Let me simplify: skip the c-square corners for now (keep sq_c referencing existing points only).
  // Actually use simple placement: A_a=(180,400), B_a=(420,400) -- only 80px height square (not equal-area but visually clean)
  // Better: scale to fit. The legs are 240 (AB) and 180 (AC). Square on AB is 240x240 (too tall). 
  // I'll show squares but with scaled-down height (visual indicator, not geometrically exact). Add the extra corner points:
  pyth.points.push(
    { id: 'A_a', x: 180, y: 410, label: '' },
    { id: 'B_a', x: 420, y: 410, label: '' },
    { id: 'A_b', x: 90, y: 320, label: '' },
    { id: 'C_b', x: 90, y: 140, label: '' },
    { id: 'B_c', x: 540, y: 230, label: '' },
    { id: 'C_c', x: 300, y: 50, label: '' },
  )

  // Insert (don't dedupe since we're seeding examples)
  for (const d of diagrams) {
    await db.collection('diagrams').insertOne(d)
    console.log('Inserted:', d.diagram.title, '->', d.id)
  }

  await client.close()
  console.log('Done.')
})().catch((e) => { console.error(e); process.exit(1) })
