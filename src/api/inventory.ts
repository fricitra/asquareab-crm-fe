import { apiClient } from "../lib/api-client";
import { buildListQueryParams, type ListQueryParams } from "../lib/list-pagination";

type NamedLink = {
  id: string | null;
  name: string | null;
};

export type Project = {
  id: string;
  projectCode: string;
  erpProjectId: string | null;
  name: string;
  description: string | null;
  locationCode: string | null;
  legalEntityCode: string | null;
  currencyCode: string | null;
  status: string;
  isActive: boolean;
  remarks: string | null;
};

export type CreateProjectPayload = {
  projectCode: string;
  name: string;
  description?: string;
  locationCode?: string;
  legalEntityCode?: string;
  currencyCode?: string;
  remarks?: string;
};

export type Unit = {
  id: string;
  project: {
    id: string;
    projectCode: string | null;
    name: string | null;
  };
  erpUnitId: string | null;
  unitCode: string;
  unitName: string | null;
  blockCode: string | null;
  floorNo: string | null;
  inventoryCode: string | null;
  developmentPhase: string | null;
  buildingName: string | null;
  unitType: NamedLink;
  unitSubType: NamedLink;
  stack: NamedLink;
  viewCategory: NamedLink;
  bedroomCount: number | null;
  grossArea: number | null;
  netArea: number | null;
  basePrice: number | null;
  currencyCode: string | null;
  availabilityStatus: {
    id: string;
    name: string | null;
    code: string | null;
  };
  reservationStatus: NamedLink;
  status: string;
  isActive: boolean;
  remarks: string | null;
  catalogue?: UnitCatalogue;
};

export type CreateUnitPayload = {
  projectId: string;
  unitCode: string;
  unitName?: string;
  blockCode?: string;
  floorNo?: string;
  inventoryCode?: string;
  developmentPhase?: string;
  buildingName?: string;
  unitTypeRefId?: string;
  unitSubTypeRefId?: string;
  stackRefId?: string;
  bedroomCount?: number;
  grossArea?: number;
  netArea?: number;
  basePrice?: number;
  currencyCode?: string;
  availabilityStatusRefId?: string;
  remarks?: string;
};

export type UnitCatalogue = {
  configuration: UnitConfiguration | null;
  areaSchedule: UnitAreaSchedule | null;
  locationAttributes: UnitLocationAttributes | null;
  parkingStorage: UnitParkingStorage | null;
  specification: UnitSpecification | null;
  salesInformation: UnitSalesInformation | null;
};

export type UnitConfiguration = {
  livingRoomQty: number | null;
  familyLoungeQty: number | null;
  diningAreaQty: number | null;
  masterBedroomQty: number | null;
  bedroom2Qty: number | null;
  bedroom3Qty: number | null;
  bedroom4Qty: number | null;
  masterBathroomQty: number | null;
  ensuiteBathroomQty: number | null;
  commonBathroomQty: number | null;
  powderRoomQty: number | null;
  guestToiletQty: number | null;
  kitchenQty: number | null;
  showKitchenQty: number | null;
  backKitchenQty: number | null;
  pantryQty: number | null;
  laundryRoomQty: number | null;
  utilityRoomQty: number | null;
  maidRoomQty: number | null;
  maidBathroomQty: number | null;
  storageRoomQty: number | null;
  balconyQty: number | null;
  terraceQty: number | null;
  outdoorLoungeQty: number | null;
  outdoorDiningQty: number | null;
  remarks: string | null;
};

export type UnitAreaSchedule = {
  areaUom: "SQM" | "SQFT";
  internalArea: number | null;
  balconyArea: number | null;
  terraceArea: number | null;
  utilityArea: number | null;
  maidArea: number | null;
  storageArea: number | null;
  privatePoolArea: number | null;
  outdoorLoungeArea: number | null;
  carpetArea: number | null;
  commonArea: number | null;
  saleableArea: number | null;
  remarks: string | null;
};

export type UnitLocationAttributes = {
  viewType: NamedLink;
  orientation: NamedLink;
  oceanFront: boolean;
  oceanView: boolean;
  partialOceanView: boolean;
  gardenView: boolean;
  poolView: boolean;
  cornerUnit: boolean;
  endUnit: boolean;
  premiumStack: boolean;
  penthouseLevel: boolean;
  remarks: string | null;
};

export type UnitParkingStorage = {
  parkingAllocation: NamedLink;
  parkingType: NamedLink;
  parkingBayNumber: string | null;
  evChargingProvision: boolean;
  storageAllocation: NamedLink;
  storageLocker: boolean;
  storageLockerNumber: string | null;
  remarks: string | null;
};

export type UnitSpecification = {
  smartHomeReady: boolean;
  homeAutomationPackage: NamedLink;
  premiumAppliancePackage: NamedLink;
  floorFinishType: NamedLink;
  kitchenFinishType: NamedLink;
  bathroomFinishType: NamedLink;
  ceilingHeight: string | null;
  floorToCeilingGlass: boolean;
  highSpeedInternetReady: boolean;
  energyEfficientFixtures: boolean;
  privateLiftAccess: boolean;
  privateLiftLobby: boolean;
  privatePool: boolean;
  privateJacuzzi: boolean;
  bbqArea: boolean;
  entertainmentTerrace: boolean;
  remarks: string | null;
};

export type UnitSalesInformation = {
  launchDate: string | null;
  salesReleaseDate: string | null;
  baseSellingPrice: number | null;
  premiumAmount: number | null;
  discountCeilingPct: number | null;
  approvedSellingPrice: number | null;
  reservationAmount: number | null;
  currentMarketValue: number | null;
  salesStatus: {
    id: string | null;
    name: string | null;
    code: string | null;
  };
  remarks: string | null;
};

export type UpsertUnitConfigurationPayload = Partial<Record<Exclude<keyof UnitConfiguration, "remarks">, number>> & { remarks?: string };
export type UpsertUnitAreaSchedulePayload = Partial<Record<Exclude<keyof UnitAreaSchedule, "areaUom" | "remarks">, number>> & { areaUom?: "SQM" | "SQFT"; remarks?: string };
export type UpsertUnitLocationAttributesPayload = {
  viewTypeRefId?: string;
  orientationRefId?: string;
  oceanFront?: boolean;
  oceanView?: boolean;
  partialOceanView?: boolean;
  gardenView?: boolean;
  poolView?: boolean;
  cornerUnit?: boolean;
  endUnit?: boolean;
  premiumStack?: boolean;
  penthouseLevel?: boolean;
  remarks?: string;
};
export type UpsertUnitParkingStoragePayload = {
  parkingAllocationRefId?: string;
  parkingTypeRefId?: string;
  parkingBayNumber?: string;
  evChargingProvision?: boolean;
  storageAllocationRefId?: string;
  storageLocker?: boolean;
  storageLockerNumber?: string;
  remarks?: string;
};
export type UpsertUnitSpecificationPayload = {
  smartHomeReady?: boolean;
  homeAutomationPackageRefId?: string;
  premiumAppliancePackageRefId?: string;
  floorFinishTypeRefId?: string;
  kitchenFinishTypeRefId?: string;
  bathroomFinishTypeRefId?: string;
  ceilingHeight?: string;
  floorToCeilingGlass?: boolean;
  highSpeedInternetReady?: boolean;
  energyEfficientFixtures?: boolean;
  privateLiftAccess?: boolean;
  privateLiftLobby?: boolean;
  privatePool?: boolean;
  privateJacuzzi?: boolean;
  bbqArea?: boolean;
  entertainmentTerrace?: boolean;
  remarks?: string;
};
export type UpsertUnitSalesInformationPayload = {
  launchDate?: string;
  salesReleaseDate?: string;
  baseSellingPrice?: number;
  premiumAmount?: number;
  discountCeilingPct?: number;
  approvedSellingPrice?: number;
  reservationAmount?: number;
  currentMarketValue?: number;
  salesStatusRefId?: string;
  remarks?: string;
};

export async function listProjects(params?: ListQueryParams) {
  const response = await apiClient.get<{
    items: Project[];
    pagination: { limit: number; offset: number; total: number };
  }>("/inventory/projects", {
    params: buildListQueryParams(params)
  });
  return response.data;
}

export async function listUnits(params?: ListQueryParams) {
  const response = await apiClient.get<{
    items: Unit[];
    pagination: { limit: number; offset: number; total: number };
  }>("/inventory/units", {
    params: buildListQueryParams(params)
  });
  return response.data;
}

export async function getUnit(id: string) {
  const response = await apiClient.get<Unit>(`/inventory/units/${id}`);
  return response.data;
}

export async function getProject(id: string) {
  const response = await apiClient.get<Project>(`/inventory/projects/${id}`);
  return response.data;
}

export async function createProject(payload: CreateProjectPayload) {
  const response = await apiClient.post<Project>("/inventory/projects", payload);
  return response.data;
}

export async function updateProject(id: string, payload: Partial<CreateProjectPayload>) {
  const response = await apiClient.patch<Project>(`/inventory/projects/${id}`, payload);
  return response.data;
}

export async function createUnit(payload: CreateUnitPayload) {
  const response = await apiClient.post<Unit>("/inventory/units", payload);
  return response.data;
}

export async function updateUnit(id: string, payload: Partial<CreateUnitPayload>) {
  const response = await apiClient.patch<Unit>(`/inventory/units/${id}`, payload);
  return response.data;
}

export async function upsertUnitConfiguration(id: string, payload: UpsertUnitConfigurationPayload) {
  const response = await apiClient.put<Unit>(`/inventory/units/${id}/configuration`, payload);
  return response.data;
}

export async function upsertUnitAreaSchedule(id: string, payload: UpsertUnitAreaSchedulePayload) {
  const response = await apiClient.put<Unit>(`/inventory/units/${id}/area-schedule`, payload);
  return response.data;
}

export async function upsertUnitLocationAttributes(id: string, payload: UpsertUnitLocationAttributesPayload) {
  const response = await apiClient.put<Unit>(`/inventory/units/${id}/location-attributes`, payload);
  return response.data;
}

export async function upsertUnitParkingStorage(id: string, payload: UpsertUnitParkingStoragePayload) {
  const response = await apiClient.put<Unit>(`/inventory/units/${id}/parking-storage`, payload);
  return response.data;
}

export async function upsertUnitSpecification(id: string, payload: UpsertUnitSpecificationPayload) {
  const response = await apiClient.put<Unit>(`/inventory/units/${id}/specification`, payload);
  return response.data;
}

export async function upsertUnitSalesInformation(id: string, payload: UpsertUnitSalesInformationPayload) {
  const response = await apiClient.put<Unit>(`/inventory/units/${id}/sales-information`, payload);
  return response.data;
}
