// Placeholder chat data shared by app/chats.js (list) and
// app/chats/[id].js (detail) — there's no chat/messaging backend yet.
// Only the first conversation has a full transcript (matching the
// mockup); the rest show an honest empty state in the detail screen
// rather than fabricated message content.
export const MOCK_CHATS = [
  {
    id: '1',
    customerName: 'Ishita Bhalla',
    vendorName: 'Copperleaf Interiors',
    orderCode: 'ORD-88213',
    lastMessage: 'Can the runner be shipped by Friday?',
    time: '2 min',
    unread: true,
    messages: [
      { id: 'm1', from: 'customer', name: 'Ishita', time: '9:40 am', text: 'Hi! Just placed order ORD-88213, could this be shipped by Friday?' },
      { id: 'm2', from: 'vendor', name: 'Copperleaf Interiors', time: '9:52 am', text: "Yes, we can dispatch it tomorrow morning — you'll have it well before Friday." },
      { id: 'm3', from: 'customer', name: 'Ishita', time: '9:53 am', text: 'Perfect, thank you!' },
      { id: 'm4', from: 'vendor', name: 'Copperleaf Interiors', time: '10:15 am', text: 'Shipped! Tracking ID sent to your email.' },
    ],
  },
  {
    id: '2',
    customerName: 'Divya Krishnan',
    vendorName: 'Voltage Fix Electricians',
    orderCode: null,
    lastMessage: 'Technician confirmed for 11 am.',
    previewPrefix: 'You:',
    time: '1 hr',
    unread: false,
    messages: [],
  },
  {
    id: '3',
    customerName: 'Arjun Malhotra',
    vendorName: 'Pixel Frame Studios',
    orderCode: null,
    lastMessage: 'Reported: no response in 3 days.',
    time: 'Yesterday',
    unread: true,
    messages: [],
  },
  {
    id: '4',
    customerName: 'Rohan Vats',
    vendorName: 'Terra Clay Pottery',
    orderCode: null,
    lastMessage: 'Thread closed — issue resolved.',
    time: '2 days',
    unread: false,
    messages: [],
  },
];