import { PrismaClient, LeadSource, LeadStatus, DealStage, ContractStatus, ActivityType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@crm.ro' },
    update: { apiKey: process.env.API_KEY || 'crm-secret-key-2024' },
    create: {
      email: 'admin@crm.ro',
      name: 'Admin CRM',
      role: 'admin',
      apiKey: process.env.API_KEY || 'crm-secret-key-2024',
    },
  });

  console.log('Created admin user:', admin.email);

  // Create 10 leads (Romanian companies)
  const leadsData = [
    { name: 'Ion Popescu', email: 'ion.popescu@techromania.ro', phone: '+40721000001', company: 'TechRomania SRL', source: LeadSource.WEBSITE, status: LeadStatus.NEW, score: 30 },
    { name: 'Maria Ionescu', email: 'maria.ionescu@softdev.ro', phone: '+40721000002', company: 'SoftDev SA', source: LeadSource.LINKEDIN, status: LeadStatus.CONTACTED, score: 55 },
    { name: 'Gheorghe Dumitrescu', email: 'g.dumitrescu@autoparts.ro', phone: '+40721000003', company: 'AutoParts Romania', source: LeadSource.REFERRAL, status: LeadStatus.QUALIFIED, score: 75 },
    { name: 'Elena Stanescu', email: 'elena.stanescu@mediavision.ro', phone: '+40721000004', company: 'MediaVision SRL', source: LeadSource.COLD_CALL, status: LeadStatus.CONTACTED, score: 45 },
    { name: 'Andrei Popa', email: 'andrei.popa@constructii-nord.ro', phone: '+40721000005', company: 'Constructii Nord SA', source: LeadSource.WEBSITE, status: LeadStatus.QUALIFIED, score: 80 },
    { name: 'Cristina Moldovan', email: 'c.moldovan@agrofarm.ro', phone: '+40721000006', company: 'AgroFarm SRL', source: LeadSource.LINKEDIN, status: LeadStatus.NEW, score: 20 },
    { name: 'Mihai Radu', email: 'mihai.radu@logisticspro.ro', phone: '+40721000007', company: 'LogisticsPro SA', source: LeadSource.REFERRAL, status: LeadStatus.UNQUALIFIED, score: 10 },
    { name: 'Ioana Munteanu', email: 'ioana.munteanu@retailzone.ro', phone: '+40721000008', company: 'RetailZone SRL', source: LeadSource.OTHER, status: LeadStatus.CONVERTED, score: 90 },
    { name: 'Florin Constantin', email: 'f.constantin@itconsult.ro', phone: '+40721000009', company: 'IT Consult Romania', source: LeadSource.WEBSITE, status: LeadStatus.QUALIFIED, score: 70 },
    { name: 'Roxana Apostol', email: 'r.apostol@financeplus.ro', phone: '+40721000010', company: 'FinancePlus SA', source: LeadSource.LINKEDIN, status: LeadStatus.CONTACTED, score: 50 },
  ];

  const leads = [];
  for (const leadData of leadsData) {
    const lead = await prisma.lead.upsert({
      where: { email: leadData.email },
      update: {},
      create: { ...leadData, ownerId: admin.id },
    });
    leads.push(lead);
    await prisma.activity.create({
      data: {
        type: ActivityType.LEAD_CREATED,
        description: `Lead created: ${lead.name}`,
        userId: admin.id,
        leadId: lead.id,
      },
    });
  }

  console.log(`Created ${leads.length} leads`);

  // Create 5 deals
  const dealsData = [
    { title: 'Deal - AutoParts Romania', leadIdx: 2, value: 15000, probability: 70, stage: DealStage.PROPOSAL },
    { title: 'Deal - Constructii Nord SA', leadIdx: 4, value: 50000, probability: 80, stage: DealStage.NEGOTIATION },
    { title: 'Deal - RetailZone SRL', leadIdx: 7, value: 25000, probability: 95, stage: DealStage.WON },
    { title: 'Deal - IT Consult Romania', leadIdx: 8, value: 12000, probability: 60, stage: DealStage.QUALIFIED },
    { title: 'Deal - MediaVision SRL', leadIdx: 3, value: 8000, probability: 30, stage: DealStage.PROSPECT },
  ];

  const deals = [];
  for (const dealData of dealsData) {
    const { leadIdx, ...rest } = dealData;
    const deal = await prisma.deal.create({
      data: {
        ...rest,
        leadId: leads[leadIdx].id,
        ownerId: admin.id,
        closedAt: rest.stage === DealStage.WON ? new Date() : null,
      },
    });
    deals.push(deal);
    await prisma.activity.create({
      data: {
        type: ActivityType.DEAL_CREATED,
        description: `Deal created: ${deal.title}`,
        userId: admin.id,
        dealId: deal.id,
        leadId: leads[leadIdx].id,
      },
    });
  }

  console.log(`Created ${deals.length} deals`);

  // Create 2 contracts
  const contractsData = [
    { dealIdx: 2, status: ContractStatus.SIGNED, content: 'Contract de prestari servicii\n\nIntre RetailZone SRL si CRM Solutions SA\n\nObiect: Implementare sistem CRM\nValoare: 25.000 RON\n\nSemnat si parafat.' },
    { dealIdx: 1, status: ContractStatus.SENT, content: 'Contract de prestari servicii\n\nIntre Constructii Nord SA si CRM Solutions SA\n\nObiect: Consultanta si implementare\nValoare: 50.000 RON\n\nIn asteptarea semnarii.' },
  ];

  for (let i = 0; i < contractsData.length; i++) {
    const { dealIdx, ...rest } = contractsData[i];
    const count = await prisma.contract.count();
    const number = `CNT-${String(count + 1).padStart(3, '0')}`;
    const contract = await prisma.contract.create({
      data: {
        ...rest,
        number,
        dealId: deals[dealIdx].id,
        signedAt: rest.status === ContractStatus.SIGNED ? new Date() : null,
      },
    });
    await prisma.activity.create({
      data: {
        type: rest.status === ContractStatus.SIGNED ? ActivityType.CONTRACT_SIGNED : ActivityType.CONTRACT_CREATED,
        description: `Contract ${number} ${rest.status === ContractStatus.SIGNED ? 'signed' : 'created'}`,
        userId: admin.id,
        dealId: deals[dealIdx].id,
        contractId: contract.id,
      },
    });
    console.log(`Created contract: ${number}`);
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
