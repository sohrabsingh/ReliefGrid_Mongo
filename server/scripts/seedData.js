const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Need = require('../models/Need');
const Resource = require('../models/Resource');
const Volunteer = require('../models/Volunteer');
const Shelter = require('../models/Shelter');
const Delivery = require('../models/Delivery');

// Trivandrum district, roughly matching the sample document in the design doc
// (coordinates: [76.9558, 8.5241]). Wards are small offsets around that centre.
const WARDS = {
  'Ward 3 - Fort':        [76.9366, 8.4855],
  'Ward 5 - Kazhakkoottam':[76.8636, 8.5654],
  'Ward 7 - Pettah':       [76.9558, 8.5241],
  'Ward 9 - Kovalam':      [76.9784, 8.4004],
  'Ward 12 - Sreekaryam':  [76.9366, 8.5548],
  'Ward 14 - Vattiyoorkavu':[76.9721, 8.5461],
};

function point([lng, lat]) {
  return { type: 'Point', coordinates: [lng, lat] };
}

function jitter([lng, lat], meters = 400) {
  const d = meters / 111320; // ~degrees per metre at the equator, close enough for a demo
  return [lng + (Math.random() - 0.5) * d, lat + (Math.random() - 0.5) * d];
}

async function seedDatabase() {
  await Promise.all([
    User.deleteMany({}),
    Need.deleteMany({}),
    Resource.deleteMany({}),
    Volunteer.deleteMany({}),
    Shelter.deleteMany({}),
    Delivery.deleteMany({}),
  ]);

  const [officerHash, volunteerHash, citizenHash] = await Promise.all(
    ['officer123', 'volunteer123', 'citizen123'].map((p) => bcrypt.hash(p, 10))
  );

  await User.insertMany([
    { name: 'District Officer', username: 'officer1', passwordHash: officerHash, role: 'officer' },
    { name: 'Volunteer Lead', username: 'volunteer1', passwordHash: volunteerHash, role: 'volunteer' },
    { name: 'Demo Citizen', username: 'citizen1', passwordHash: citizenHash, role: 'citizen' },
  ]);

  const wardNames = Object.keys(WARDS);

  const shelters = await Shelter.insertMany([
    {
      name: 'Fort Community Hall Shelter',
      capacity: 200,
      occupancy: 140,
      facilities: ['medical_post', 'kitchen', 'water_point'],
      location: point(WARDS['Ward 3 - Fort']),
      contact: { name: 'Shelter Warden A', phone: '+91-9000000001' },
    },
    {
      name: 'Kazhakkoottam Govt School Shelter',
      capacity: 350,
      occupancy: 310,
      facilities: ['kitchen', 'sanitation'],
      location: point(WARDS['Ward 5 - Kazhakkoottam']),
      contact: { name: 'Shelter Warden B', phone: '+91-9000000002' },
    },
    {
      name: 'Kovalam Relief Camp',
      capacity: 120,
      occupancy: 40,
      facilities: ['medical_post'],
      location: point(WARDS['Ward 9 - Kovalam']),
      contact: { name: 'Shelter Warden C', phone: '+91-9000000003' },
    },
  ]);

  const resources = await Resource.insertMany([
    {
      ownerOrg: 'Red Cross Mobile Medical Unit 1',
      category: 'medical',
      stock: 20,
      items: [{ name: 'insulin', qty: 20, unit: 'vial' }],
      location: point(WARDS['Ward 7 - Pettah']),
      availability: 'free',
      vehicle: 'ambulance',
      contact: { name: 'Dr. Nair', phone: '+91-9100000001' },
    },
    {
      ownerOrg: 'St. John Ambulance Kerala',
      category: 'medical',
      stock: 10,
      items: [{ name: 'first_aid_kit', qty: 10, unit: 'kit' }],
      location: point(WARDS['Ward 12 - Sreekaryam']),
      availability: 'free',
      vehicle: 'ambulance',
      contact: { name: 'Team Lead', phone: '+91-9100000002' },
    },
    {
      ownerOrg: 'District Food Bank',
      category: 'food',
      stock: 500,
      items: [{ name: 'meal_packet', qty: 500, unit: 'packet' }],
      location: point(WARDS['Ward 5 - Kazhakkoottam']),
      availability: 'free',
      vehicle: 'truck',
      contact: { name: 'Warehouse Manager', phone: '+91-9100000003' },
    },
    {
      ownerOrg: 'Community Kitchen Fort',
      category: 'food',
      stock: 150,
      items: [{ name: 'meal_packet', qty: 150, unit: 'packet' }],
      location: point(WARDS['Ward 3 - Fort']),
      availability: 'free',
      vehicle: 'van',
      contact: { name: 'Kitchen Coordinator', phone: '+91-9100000004' },
    },
    {
      ownerOrg: 'Water Authority Tanker Unit',
      category: 'water',
      stock: 40,
      items: [{ name: 'water_can_20l', qty: 40, unit: 'can' }],
      location: point(WARDS['Ward 9 - Kovalam']),
      availability: 'free',
      vehicle: 'tanker',
      contact: { name: 'Tanker Driver', phone: '+91-9100000005' },
    },
    {
      ownerOrg: 'NGO Rescue Squad Alpha',
      category: 'rescue',
      stock: 6,
      items: [{ name: 'rescue_team_slot', qty: 6, unit: 'team' }],
      location: point(WARDS['Ward 14 - Vattiyoorkavu']),
      availability: 'free',
      vehicle: 'boat',
      contact: { name: 'Squad Alpha', phone: '+91-9100000006' },
    },
    {
      ownerOrg: 'Blanket & Tarp Depot',
      category: 'shelter',
      stock: 300,
      items: [{ name: 'blanket', qty: 300, unit: 'piece' }],
      location: point(WARDS['Ward 12 - Sreekaryam']),
      availability: 'free',
      vehicle: 'van',
      contact: { name: 'Depot Manager', phone: '+91-9100000007' },
    },
    // Already fully committed - shows the matching pipeline correctly skipping it.
    {
      ownerOrg: 'Red Cross Mobile Medical Unit 2',
      category: 'medical',
      stock: 0,
      items: [{ name: 'insulin', qty: 0, unit: 'vial' }],
      location: point(WARDS['Ward 3 - Fort']),
      availability: 'busy',
      vehicle: 'ambulance',
      contact: { name: 'Dr. Menon', phone: '+91-9100000008' },
    },
  ]);

  const volunteers = await Volunteer.insertMany([
    {
      name: 'Anjali Kumar',
      phone: '+91-9200000001',
      skills: ['first_aid', 'driving'],
      currentLocation: point(WARDS['Ward 7 - Pettah']),
      radiusKm: 6,
      verificationLevel: 1,
      linkedResource: resources[0]._id,
    },
    {
      name: 'Rahul Menon',
      phone: '+91-9200000002',
      skills: ['logistics'],
      currentLocation: point(WARDS['Ward 5 - Kazhakkoottam']),
      radiusKm: 8,
      verificationLevel: 1,
      linkedResource: resources[2]._id,
    },
    {
      name: 'Sneha Pillai',
      phone: '+91-9200000003',
      skills: ['swimming', 'first_aid'],
      currentLocation: point(WARDS['Ward 14 - Vattiyoorkavu']),
      radiusKm: 5,
      verificationLevel: 0,
    },
  ]);

  // A representative spread of needs: some clean, one duplicate pair (same spot,
  // same category, a few minutes apart) to exercise duplicate detection, one that
  // will fail to match anything nearby (demonstrates NoCapacityError), and the exact
  // sample document from the design doc.
  const sampleWard = WARDS['Ward 7 - Pettah'];

  const needsToCreate = [
    {
      category: 'medical',
      items: [{ name: 'insulin', qty: 6, unit: 'vial' }],
      urgency: 5,
      vulnerableCount: 2,
      description: 'Diabetic elderly couple, out of insulin since yesterday, need cold-chain delivery',
      location: point(sampleWard),
      ward: 'Ward 7 - Pettah',
      status: 'verified',
      reportedBy: { name: 'Helpline Op', phone: '+91-9300000001', channel: 'officer' },
    },
    {
      category: 'food',
      items: [{ name: 'meal_packet', qty: 80, unit: 'packet' }],
      urgency: 3,
      vulnerableCount: 15,
      description: 'Shelter kitchen out of supplies, 80 people waiting for dinner',
      location: point(jitter(WARDS['Ward 5 - Kazhakkoottam'])),
      ward: 'Ward 5 - Kazhakkoottam',
      status: 'verified',
      reportedBy: { name: 'Shelter Warden B', phone: '+91-9000000002', channel: 'officer' },
    },
    {
      category: 'water',
      items: [{ name: 'water_can_20l', qty: 12, unit: 'can' }],
      urgency: 4,
      vulnerableCount: 5,
      description: 'Borewell contaminated by floodwater, generator still running but no clean water',
      location: point(jitter(WARDS['Ward 9 - Kovalam'])),
      ward: 'Ward 9 - Kovalam',
      status: 'pending',
      reportedBy: { channel: 'sms', phone: '+91-9400000001' },
    },
    {
      category: 'rescue',
      items: [{ name: 'rescue_team_slot', qty: 1, unit: 'team' }],
      urgency: 5,
      vulnerableCount: 4,
      description: 'Family of 4 trapped on rooftop, water still rising, need boat',
      location: point(jitter(WARDS['Ward 14 - Vattiyoorkavu'])),
      ward: 'Ward 14 - Vattiyoorkavu',
      status: 'pending',
      reportedBy: { channel: 'app', phone: '+91-9400000002' },
    },
    // Duplicate pair - both reporting the same flooded street within minutes.
    {
      category: 'shelter',
      items: [{ name: 'blanket', qty: 20, unit: 'piece' }],
      urgency: 3,
      vulnerableCount: 6,
      location: point(WARDS['Ward 3 - Fort']),
      ward: 'Ward 3 - Fort',
      status: 'pending',
      reportedBy: { channel: 'app', phone: '+91-9400000003' },
    },
    {
      category: 'shelter',
      items: [{ name: 'blanket', qty: 18, unit: 'piece' }],
      urgency: 3,
      vulnerableCount: 6,
      location: point(jitter(WARDS['Ward 3 - Fort'], 80)),
      ward: 'Ward 3 - Fort',
      status: 'pending',
      reportedBy: { channel: 'sms', phone: '+91-9400000004' },
    },
    // Far outside every resource's 15km radius - the matching engine should find nothing.
    {
      category: 'medical',
      items: [{ name: 'insulin', qty: 3, unit: 'vial' }],
      urgency: 5,
      vulnerableCount: 1,
      location: point([77.55, 9.2]), // ~90km away
      ward: 'Remote Ward',
      status: 'verified',
      reportedBy: { channel: 'app', phone: '+91-9400000005' },
    },
  ];

  const needs = [];
  for (const n of needsToCreate) {
    needs.push(await Need.create(n)); // sequential so createdAt ordering is meaningful for duplicate detection
  }

  return { wards: wardNames, shelters, resources, volunteers, needs };
}

module.exports = { seedDatabase, WARDS, point, jitter };
