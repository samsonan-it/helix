import { PrismaClient } from '@prisma/client';
import { FlagKeys } from '../src/config/flag-keys';

const prisma = new PrismaClient();

// Dev users for local development and demos
const DEV_USERS = [
  { email: 'requester@stada.dev', name: 'Alice Requester', roles: ['DemandRequester'] },
  { email: 'controller@stada.dev', name: 'Bob Controller', roles: ['BusinessController'] },
  { email: 'manager@stada.dev', name: 'Carol Manager', roles: ['DemandManager'] },
  { email: 'portfolio@stada.dev', name: 'David Portfolio', roles: ['PortfolioManager'] },
  { email: 'pm@stada.dev', name: 'Eve Project', roles: ['ProjectManager'] },
  { email: 'itcco@stada.dev', name: 'Frank ITCCO', roles: ['ITCostCenterOwner'] },
  { email: 'sec@stada.dev', name: 'Grace SEC', roles: ['SECMember'] },
];

// Admin bootstrap user
const ADMIN_USERS = [
  { email: 'admin@stada.dev', name: 'Helix Admin', roles: ['Admin'] },
];

// Feature flags — all seeded false per ARCH-11
// Keys must match FlagKeys constants (CLAUDE.md rule 3)
const FEATURE_FLAGS = [
  { key: FlagKeys.AI_PREFILL,             value: false, description: 'AI free-text prefill — off until DPA signed (Roman/Michael)' },
];

// Source: Inputs/binaries/source/IT Cost Center.xlsx — GIS (STADA AG), GIS (STADA IT SOLUTIONS), HEMOFARM
const COST_CENTRES = [
  // GIS (STADA AG)
  { code: '4029',  name: '10110016' },
  { code: '14139', name: '10111010' },
  { code: '13902', name: '10111011' },
  { code: '13901', name: '10111012' },
  { code: '4030',  name: '10111014' },
  { code: '4031',  name: '10111015' },
  { code: '4032',  name: '10111017' },
  { code: '13900', name: '10111019' },
  { code: '4033',  name: '10111020' },
  { code: '4034',  name: '10111038' },
  { code: '4035',  name: '10111039' },
  { code: '4036',  name: '10111047' },
  { code: '13903', name: '10111053' },
  { code: '13904', name: '10111066' },
  { code: '4038',  name: '10111070' },
  { code: '4039',  name: '10111071' },
  { code: '13050', name: '10111072' },
  { code: '4040',  name: '10111073' },
  { code: '13905', name: '10111080' },
  { code: '4041',  name: '10111090' },
  { code: '4042',  name: '10111091' },
  { code: '4043',  name: '10111092' },
  { code: '4044',  name: '10111093' },
  { code: '4045',  name: '10111094' },
  { code: '4046',  name: '10111095' },
  { code: '4047',  name: '10111096' },
  { code: '4048',  name: '10111097' },
  { code: '4049',  name: '10111098' },
  { code: '4050',  name: '99304265' },
  // GIS (STADA IT SOLUTIONS)
  { code: '10935', name: '24200010' },
  // HEMOFARM
  { code: '4051',  name: '24200000' },
];

const GL_ACCOUNTS = [
  // OPEX + CAPEX
  { code: '1630318000', name: 'Consulting_internal (STADA AG)', description: null,                                        categories: ['opex', 'capex'] },
  { code: '1678050410', name: 'Consulting_SITS',                description: null,                                        categories: ['opex', 'capex'] },
  { code: '1678050300', name: 'consulting_internal_ES',         description: null,                                        categories: ['opex', 'capex'] },
  { code: '1678050000', name: 'Consultants Fees',               description: null,                                        categories: ['opex', 'capex'] },
  { code: '1991000000', name: 'Hardware',                       description: 'Hardware purchases and equipment',          categories: ['opex', 'capex'] },
  { code: '1992000000', name: 'Software Licenses',              description: 'Software licenses and SaaS subscriptions',  categories: ['opex', 'capex'] },
  // OPEX only
  { code: '1666011000', name: 'Accommo indiv w/o VA',           description: null,                                        categories: ['opex'] },
  { code: '1665020000', name: 'Air/rail/taxi travel',           description: null,                                        categories: ['opex'] },
  { code: '1682120000', name: 'Conf entertainment',             description: 'Conference and entertainment expenses',     categories: ['opex'] },
  { code: '1678050600', name: 'Consultant fees IT',             description: null,                                        categories: ['opex'] },
  { code: '1678030000', name: 'F/l emp costs',                  description: null,                                        categories: ['opex'] },
  { code: '1631020200', name: 'Host. Betr.+Gesch-Au',           description: null,                                        categories: ['opex'] },
  { code: '1682500000', name: 'Legal Costs',                    description: null,                                        categories: ['opex'] },
  { code: '1696940000', name: 'O/op exp chrge_IC',              description: null,                                        categories: ['opex'] },
  { code: '1696900200', name: 'Other expense (CC)',             description: null,                                        categories: ['opex'] },
  { code: '1678000000', name: 'Other ext services',             description: null,                                        categories: ['opex'] },
  { code: '1631010000', name: 'Syst software rental',           description: null,                                        categories: ['opex'] },
  { code: '1682100000', name: 'Training exp',                   description: null,                                        categories: ['opex'] },
  { code: '1665050000', name: 'Travel Costs',                   description: null,                                        categories: ['opex'] },
  // Benefits
  { code: 'B001',       name: 'Profit Increase',                              description: 'Revenue or margin improvement from the initiative',  categories: ['benefits'] },
  { code: 'B002',       name: 'Cost savings - non-Personal expenses',         description: 'Reduction in non-personnel operating costs',         categories: ['benefits'] },
  { code: 'B003',       name: 'Cost savings - Personal expenses',             description: 'Reduction in personnel-related costs',               categories: ['benefits'] },
];

const LEGAL_ENTITIES = [
  { code: '5920', name: '1011 - STADA AG' },
  { code: '5919', name: '1015 - BIOCEUTICALS' },
  { code: '5918', name: '1022 - STADA R&D GmbH' },
  { code: '5917', name: '1033 - Bepha' },
  { code: '5916', name: '1040 - Socialites Ret.GmbH' },
  { code: '5915', name: '1066 - Mobilat Prod.GmbH' },
  { code: '5914', name: '1090 - ALIUD D' },
  { code: '5913', name: '1095 - SMC' },
  { code: '5912', name: '1110 - STADAPHARM GmbH' },
  { code: '5911', name: '1113 - STADA CEE GmbH' },
  { code: '5910', name: '1404 - NorBiTec' },
  { code: '5909', name: '1405 - STADA GmbH' },
  { code: '5908', name: '1705 - Hemopharm GmbH' },
  { code: '5907', name: '2200 - STADA NL' },
  { code: '5906', name: '2201 - Centrafarm NL B.V.' },
  { code: '5905', name: '2202 - Centrafarm B.V.' },
  { code: '5904', name: '2204 - Healthy' },
  { code: '5903', name: '2206 - Centrafarm Servic BV' },
  { code: '5902', name: '2208 - Socialites Nederland' },
  { code: '5901', name: '2220 - S.A. Eurogenerics' },
  { code: '5900', name: '2235 - EG Labo F' },
  { code: '5899', name: '2250 - Slam Trading Ltd.' },
  { code: '5898', name: '2254 - Lowry Solutions Ltd.' },
  { code: '5897', name: '2256 - BSMW Limited' },
  { code: '5896', name: '2259 - Natures Aid Limited' },
  { code: '5895', name: '2261 - Spirig HealthCare AG' },
  { code: '5894', name: '2263 - Pegach AG' },
  { code: '5893', name: '2268 - Internis Pharm. Lim.' },
  { code: '5892', name: '2269 - STADA UK Holdings Ld' },
  { code: '5891', name: '2274 - Thornton & Ross Ltd.' },
  { code: '5890', name: '2281 - Britannia' },
  { code: '5889', name: '2282 - Genus GB Pharma Ltd.' },
  { code: '5888', name: '2283 - Cross' },
  { code: '5887', name: '2285 - Clonmel' },
  { code: '5886', name: '2288 - SFI' },
  { code: '5885', name: '2290 - STADA AUT' },
  { code: '5884', name: '2293 - SCIOTEC Diag. Tech.' },
  { code: '5883', name: '2300 - STADA Nordic ApS' },
  { code: '23373', name: '2331 - WALMARK a.s.' },
  { code: '5879', name: '2334 - STADA Poland SP.zo.o' },
  { code: '5882', name: '2352 - STADA Pharma CZ' },
  { code: '5881', name: '2354 - STADA PHARMA BG' },
  { code: '5880', name: '2356 - STADA PHARMA SK' },
  { code: '5878', name: '2400 - EG Italien' },
  { code: '5877', name: '2410 - Crinos' },
  { code: '5876', name: '2440 - Stada Spanien' },
  { code: '5875', name: '2460 - Ciclum Portugal' },
  { code: '5874', name: '2600 - OAO Nizhpharm' },
  { code: '5873', name: '2601 - OOO STADA Marketing' },
  { code: '5872', name: '2604 - ZAO Makiz-Pharma' },
  { code: '5871', name: '2608 - OOO Aqualor' },
  { code: '5870', name: '2610 - Nizh-Ukraine DO' },
  { code: '5869', name: '2615 - STADA Baltija' },
  { code: '5868', name: '2630 - STADA M&D S.R.L.' },
  { code: '5867', name: '2700 - Hemofarm' },
  { code: '5866', name: '2705 - Velexfarm d.o.o.' },
  { code: '5865', name: '2715 - Hemomont d.o.o.' },
  { code: '5864', name: '2720 - OOO Hemofarm Obninsk' },
  { code: '5863', name: '2725 - Hemofarm S.R.L.' },
  { code: '5862', name: '2740 - Hemo Banja Luka' },
  { code: '5861', name: '2785 - STADA IT SOLUTIONS D' },
  { code: '5860', name: '2790 - STADA d.o.o. HR' },
  { code: '5859', name: '2791 - STADA Hungary LLC' },
  { code: '5858', name: '2798 - STADA d.o.o. SL' },
  { code: '5857', name: '3240 - STADA Asia' },
  { code: '5856', name: '3242 - STADA Philippines In' },
  { code: '5855', name: '3245 - STADA Company Ltd.' },
  { code: '5854', name: '3249 - STADA Pharm. Beijing' },
  { code: '5853', name: '3252 - Pymepharco' },
  { code: '5852', name: '3254 - Well Light Invest.S' },
  { code: '5851', name: '3300 - STADA Pharmaceut. AU' },
  { code: '5850', name: '3620 - Nizh-Kasachstan' },
  { code: '5849', name: '3900 - STADA MENA DWC-LLC' },
  { code: '5848', name: '6650 - Vannier' },
];

// Stada country/region reference data (Story 2.14)
const COUNTRIES = [
  { code: 'GCI',     name: 'GCI (Greece Cyprus Israel)' },
  { code: 'CEE',     name: 'CEE (Commercial South Eastern Europe)' },
  { code: 'EUARASI', name: 'Euarasi' },
  { code: 'HR',      name: 'Croatia' },
  { code: 'SK',      name: 'Slovakia' },
  { code: 'UA',      name: 'Ukraine' },
  { code: 'RO',      name: 'Romania' },
  { code: 'HU',      name: 'Hungary' },
  { code: 'PL',      name: 'Poland' },
  { code: 'CZ',      name: 'Czech' },
  { code: 'BALTICS', name: 'Baltics' },
  { code: 'BG',      name: 'Bulgaria' },
  { code: 'RS',      name: 'Serbia' },
  { code: 'EM',      name: 'Emerging Markets' },
  { code: 'UK',      name: 'UK' },
  { code: 'DE',      name: 'Germany' },
  { code: 'FR',      name: 'France' },
  { code: 'IT',      name: 'Italy' },
  { code: 'IBERIA',  name: 'Iberia & Spain' },
  { code: 'IE',      name: 'Ireland' },
  { code: 'BE',      name: 'Belgium' },
  { code: 'NL',      name: 'Netherlands' },
  { code: 'NORDICS', name: 'Nordics' },
  { code: 'CH',      name: 'Swiss' },
  { code: 'AT',      name: 'Austria' },
];

const PROJECT_AREAS = [
  { code: 'ACCT',   name: 'Accounting' },
  { code: 'CP',     name: 'Culture & People' },
  { code: 'HSE',    name: 'Health Safety & Environment' },
  { code: 'ITA',    name: 'Information Technology all' },
  { code: 'PPD',    name: 'Portfolio & Product Development' },
  { code: 'PROD',   name: 'Production' },
  { code: 'PURCH',  name: 'Purchasing' },
  { code: 'QA',     name: 'Quality Assurance' },
  { code: 'QC',     name: 'Quality Control' },
  { code: 'FPA',    name: 'Financial Planning & Analysis' },
  { code: 'RAMACA', name: 'RAMACA' },
  { code: 'SM',     name: 'Sales & Marketing' },
  { code: 'SCM',    name: 'Supply Chain Management' },
  { code: 'TAX',    name: 'Tax' },
  { code: 'TREAS',  name: 'Treasury' },
  { code: 'LOG',    name: 'Logistic' },
  { code: 'OTHER',  name: 'Business Others' },
];


async function main(): Promise<void> {
  // Dev users
  for (const user of DEV_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    });
  }
  console.log(`Seeded ${DEV_USERS.length} dev users`);

  // Admin users
  for (const user of ADMIN_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    });
  }
  console.log(`Seeded ${ADMIN_USERS.length} admin user(s)`);

  // Feature flags
  for (const flag of FEATURE_FLAGS) {
    await prisma.config.upsert({
      where: { key: flag.key },
      update: { value: flag.value, description: flag.description },
      create: flag,
    });
  }
  console.log(`Seeded ${FEATURE_FLAGS.length} feature flags`);

  // Cost centres
  for (const cc of COST_CENTRES) {
    await prisma.costCentre.upsert({
      where: { code: cc.code },
      update: {},
      create: cc,
    });
  }
  console.log(`Seeded ${COST_CENTRES.length} cost centres`);

  // GL accounts
  for (const gl of GL_ACCOUNTS) {
    await prisma.glAccount.upsert({
      where: { code: gl.code },
      update: { categories: gl.categories },
      create: gl,
    });
  }
  console.log(`Seeded ${GL_ACCOUNTS.length} GL accounts`);

  // Legal entities
  for (const le of LEGAL_ENTITIES) {
    await prisma.legalEntity.upsert({
      where: { code: le.code },
      update: {},
      create: le,
    });
  }
  console.log(`Seeded ${LEGAL_ENTITIES.length} legal entities`);

  // Project areas
  for (const area of PROJECT_AREAS) {
    await prisma.smallProjectArea.upsert({
      where: { code: area.code },
      update: {},
      create: area,
    });
  }
  console.log(`Seeded ${PROJECT_AREAS.length} project areas`);

  // Countries (Story 2.14)
  for (const country of COUNTRIES) {
    await prisma.country.upsert({
      where: { code: country.code },
      update: {},
      create: country,
    });
  }
  console.log(`Seeded ${COUNTRIES.length} countries`);

  // System config defaults — never overwrite existing admin-configured values on re-seed
  const SYSTEM_CONFIG_DEFAULTS = [
    { key: 'sp_threshold_eur_cents',    value: '5000000',   description: 'Small Project threshold in euro cents (default: €50,000 = 5,000,000 cents)' },
    { key: 'intake_window_start',        value: 'null',      description: 'Intake window open date (ISO date string or null = always open)' },
    { key: 'intake_window_end',          value: 'null',      description: 'Intake window close date (ISO date string or null = always open)' },
    { key: 'budget_cycle_start',         value: 'null',      description: 'Budget cycle start date (ISO date string or null = not set)' },
    { key: 'budget_cycle_end',           value: 'null',      description: 'Budget cycle end date (ISO date string or null = not set)' },
    { key: 'gxp_it_validation_days',     value: '30',        description: 'GxP IT Validation milestone default duration in days' },
    { key: 'gxp_documentation_days',     value: '14',        description: 'GxP Documentation milestone default duration in days' },
  ] as const;

  for (const cfg of SYSTEM_CONFIG_DEFAULTS) {
    await prisma.systemConfig.upsert({
      where: { key: cfg.key },
      update: {},
      create: cfg,
    });
  }
  console.log(`Seeded ${SYSTEM_CONFIG_DEFAULTS.length} system config defaults`);

  // Admin role assignment — keeps admin panel consistent on fresh seed
  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@stada.dev' } });
  const existingAdminRole = await prisma.userRoleAssignment.findFirst({
    where: { userId: adminUser.id, role: 'Admin', scopeId: null },
  });
  if (!existingAdminRole) {
    await prisma.userRoleAssignment.create({
      data: { userId: adminUser.id, role: 'Admin', scopeType: 'global', scopeId: null, assignedBy: adminUser.id },
    });
  }
  console.log('Seeded admin role assignment');

  // BC role assignments — Bob Controller assigned to all areas so BC picker returns results
  const bobUser = await prisma.user.findUniqueOrThrow({ where: { email: 'controller@stada.dev' } });
  const allAreas = await prisma.smallProjectArea.findMany({ select: { id: true, code: true } });
  for (const area of allAreas) {
    const existing = await prisma.userRoleAssignment.findFirst({
      where: { userId: bobUser.id, role: 'BusinessController', areaIds: { has: area.id } },
    });
    if (!existing) {
      await prisma.userRoleAssignment.create({
        data: { userId: bobUser.id, role: 'BusinessController', scopeType: 'area', areaIds: [area.id], scopeId: null, assignedBy: adminUser.id },
      });
    }
  }
  console.log(`Seeded BC role assignments for Bob Controller (${allAreas.length} areas)`);

  // DM role assignment — Carol Manager assigned globally so DM picker returns results for any area/scope
  const carolUser = await prisma.user.findUniqueOrThrow({ where: { email: 'manager@stada.dev' } });
  const existingDmRole = await prisma.userRoleAssignment.findFirst({
    where: { userId: carolUser.id, role: 'DemandManager' },
  });
  if (!existingDmRole) {
    await prisma.userRoleAssignment.create({
      data: { userId: carolUser.id, role: 'DemandManager', scopeType: 'global', areaIds: [], countryIds: [], scopeId: null, assignedBy: adminUser.id },
    });
  }
  console.log('Seeded DM role assignment for Carol Manager');

  // PM (PortfolioManager) role assignment — David Portfolio assigned globally so PM queue returns results
  const davidUser = await prisma.user.findUniqueOrThrow({ where: { email: 'portfolio@stada.dev' } });
  const existingPmRole = await prisma.userRoleAssignment.findFirst({
    where: { userId: davidUser.id, role: 'PortfolioManager' },
  });
  if (!existingPmRole) {
    await prisma.userRoleAssignment.create({
      data: { userId: davidUser.id, role: 'PortfolioManager', scopeType: 'global', scopeId: null, assignedBy: adminUser.id },
    });
  }
  console.log('Seeded PM role assignment for David Portfolio');

  // ProjectManager role assignment — Eve Project assigned globally so PM picker in approve modal returns results
  const eveUser = await prisma.user.findUniqueOrThrow({ where: { email: 'pm@stada.dev' } });
  const existingProjectManagerRole = await prisma.userRoleAssignment.findFirst({
    where: { userId: eveUser.id, role: 'ProjectManager' },
  });
  if (!existingProjectManagerRole) {
    await prisma.userRoleAssignment.create({
      data: { userId: eveUser.id, role: 'ProjectManager', scopeType: 'global', scopeId: null, assignedBy: adminUser.id },
    });
  }
  console.log('Seeded ProjectManager role assignment for Eve Project');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
