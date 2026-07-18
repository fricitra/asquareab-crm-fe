import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type UseFormRegister } from "react-hook-form";
import {
  applyUnitProduct,
  createProject,
  createUnit,
  getProject,
  getUnit,
  listProjects,
  listUnitProducts,
  listUnits,
  updateProject,
  updateUnit,
  updateUnitProduct,
  upsertUnitAreaSchedule,
  upsertUnitConfiguration,
  upsertUnitLocationAttributes,
  upsertUnitParkingStorage,
  upsertUnitSalesInformation,
  upsertUnitSpecification,
  type Project,
  type Unit,
  type UnitProduct
} from "../api/inventory";
import { listCurrencies } from "../api/currencies";
import { useMoneyFormatter } from "../hooks/useCurrencyContext";
import { useModalEscape } from "../hooks/useModalEscape";
import { DEFAULT_LIST_PAGE_SIZE } from "../lib/list-pagination";
import { nextListSort, type ListSortState } from "../lib/list-sort";
import { CurrencyBadge } from "../shared/CurrencyBadge";
import { DateField } from "../shared/DateField";
import { ListPagination } from "../shared/ListPagination";
import { SortableTh } from "../shared/SortableTh";
import { UnitVelocityBadge } from "../shared/UnitVelocityBadge";
import { getReferenceFamily, type ReferenceDataItem } from "../api/reference-data";

type InventoryTab = "projects" | "units" | "products" | "availability";
type UnitDetailTab = "identification" | "configuration" | "area" | "location" | "parking" | "specification" | "sales" | "linked";

type ProjectFormValues = {
  projectCode: string;
  name: string;
  locationCode: string;
  legalEntityCode: string;
  currencyCode: string;
  description: string;
  remarks: string;
};

type UnitFormValues = {
  projectId: string;
  productId: string;
  applyProductDefaults: boolean;
  unitCode: string;
  unitName: string;
  blockCode: string;
  floorNo: string;
  inventoryCode: string;
  developmentPhase: string;
  buildingName: string;
  unitTypeRefId: string;
  unitSubTypeRefId: string;
  stackRefId: string;
  bedroomCount: string;
  grossArea: string;
  netArea: string;
  basePrice: string;
  currencyCode: string;
  availabilityStatusRefId: string;
  remarks: string;
};

type ProductFormValues = {
  productName: string;
  targetBuyer: string;
  typicalFloorLocation: string;
  typicalView: string;
  typicalBuyerProfile: string;
  targetRateBand: string;
  remarks: string;
};

type ProductModalMode = "view" | "edit";

type ConfigurationFormValues = Record<
  | "livingRoomQty"
  | "familyLoungeQty"
  | "diningAreaQty"
  | "masterBedroomQty"
  | "bedroom2Qty"
  | "bedroom3Qty"
  | "bedroom4Qty"
  | "masterBathroomQty"
  | "ensuiteBathroomQty"
  | "commonBathroomQty"
  | "powderRoomQty"
  | "guestToiletQty"
  | "kitchenQty"
  | "showKitchenQty"
  | "backKitchenQty"
  | "pantryQty"
  | "laundryRoomQty"
  | "utilityRoomQty"
  | "maidRoomQty"
  | "maidBathroomQty"
  | "storageRoomQty"
  | "balconyQty"
  | "terraceQty"
  | "outdoorLoungeQty"
  | "outdoorDiningQty",
  string
> & { remarks: string };

type AreaFormValues = Record<
  | "internalArea"
  | "balconyArea"
  | "terraceArea"
  | "utilityArea"
  | "maidArea"
  | "storageArea"
  | "privatePoolArea"
  | "privatePoolDeckArea"
  | "outdoorLoungeArea"
  | "carpetArea"
  | "commonArea"
  | "saleableArea",
  string
> & { areaUom: "SQM" | "SQFT"; remarks: string };

type LocationFormValues = {
  viewTypeRefId: string;
  orientationRefId: string;
  oceanFront: boolean;
  oceanView: boolean;
  partialOceanView: boolean;
  gardenView: boolean;
  poolView: boolean;
  cornerUnit: boolean;
  endUnit: boolean;
  premiumStack: boolean;
  penthouseLevel: boolean;
  oceanOrientedDesign: boolean;
  crossVentilation: boolean;
  naturalDaylighting: boolean;
  remarks: string;
};

type ParkingFormValues = {
  parkingAllocationRefId: string;
  parkingTypeRefId: string;
  parkingBayNumber: string;
  evChargingProvision: boolean;
  storageAllocationRefId: string;
  storageLocker: boolean;
  storageLockerNumber: string;
  remarks: string;
};

type SpecificationFormValues = {
  smartHomeReady: boolean;
  homeAutomationPackageRefId: string;
  premiumAppliancePackageRefId: string;
  floorFinishTypeRefId: string;
  kitchenFinishTypeRefId: string;
  bathroomFinishTypeRefId: string;
  ceilingHeight: string;
  floorToCeilingGlass: boolean;
  highSpeedInternetReady: boolean;
  energyEfficientFixtures: boolean;
  privateLiftAccess: boolean;
  privateLiftLobby: boolean;
  privatePool: boolean;
  privateJacuzzi: boolean;
  bbqArea: boolean;
  entertainmentTerrace: boolean;
  remarks: string;
};

type SalesFormValues = {
  launchDate: string;
  salesReleaseDate: string;
  baseSellingPrice: string;
  premiumAmount: string;
  discountCeilingPct: string;
  approvedSellingPrice: string;
  reservationAmount: string;
  currentMarketValue: string;
  salesStatusRefId: string;
  remarks: string;
};

const unitDetailTabs: Array<{ id: UnitDetailTab; label: string }> = [
  { id: "identification", label: "Identification" },
  { id: "configuration", label: "Configuration" },
  { id: "area", label: "Area Schedule" },
  { id: "location", label: "View & Location" },
  { id: "parking", label: "Parking & Storage" },
  { id: "specification", label: "Specification" },
  { id: "sales", label: "Sales" },
  { id: "linked", label: "Linked Modules" }
];

const configurationFields: Array<{ name: keyof ConfigurationFormValues; label: string }> = [
  { name: "livingRoomQty", label: "Living Room" },
  { name: "familyLoungeQty", label: "Family Lounge" },
  { name: "diningAreaQty", label: "Dining Area" },
  { name: "masterBedroomQty", label: "Master Bedroom" },
  { name: "bedroom2Qty", label: "Bedroom 2" },
  { name: "bedroom3Qty", label: "Bedroom 3" },
  { name: "bedroom4Qty", label: "Bedroom 4" },
  { name: "masterBathroomQty", label: "Master Bathroom" },
  { name: "ensuiteBathroomQty", label: "Ensuite Bathroom" },
  { name: "commonBathroomQty", label: "Common Bathroom" },
  { name: "powderRoomQty", label: "Powder Room" },
  { name: "guestToiletQty", label: "Guest Toilet" },
  { name: "kitchenQty", label: "Kitchen" },
  { name: "showKitchenQty", label: "Show Kitchen" },
  { name: "backKitchenQty", label: "Back Kitchen" },
  { name: "pantryQty", label: "Pantry" },
  { name: "laundryRoomQty", label: "Laundry Room" },
  { name: "utilityRoomQty", label: "Utility Room" },
  { name: "maidRoomQty", label: "Maid Room" },
  { name: "maidBathroomQty", label: "Maid Bathroom" },
  { name: "storageRoomQty", label: "Storage Room" },
  { name: "balconyQty", label: "Balcony" },
  { name: "terraceQty", label: "Terrace" },
  { name: "outdoorLoungeQty", label: "Outdoor Lounge" },
  { name: "outdoorDiningQty", label: "Outdoor Dining" }
];

const areaFields: Array<{ name: keyof AreaFormValues; label: string }> = [
  { name: "internalArea", label: "Internal Area" },
  { name: "balconyArea", label: "Balcony Area" },
  { name: "terraceArea", label: "Terrace Area" },
  { name: "utilityArea", label: "Utility Area" },
  { name: "maidArea", label: "Maid Area" },
  { name: "storageArea", label: "Storage Area" },
  { name: "privatePoolArea", label: "Private Pool Area" },
  { name: "privatePoolDeckArea", label: "Private Pool Deck Area" },
  { name: "outdoorLoungeArea", label: "Outdoor Lounge Area" },
  { name: "carpetArea", label: "Carpet Area" },
  { name: "commonArea", label: "Common Area" },
  { name: "saleableArea", label: "Saleable Area" }
];

function pickString(value: string) {
  return value.trim() === "" ? undefined : value.trim();
}

function pickNumber(value: string) {
  const normalized = value.replace(/[, ]/g, "").trim();
  return normalized === "" ? undefined : Number(normalized);
}

function area(value: number | null) {
  return value === null ? "-" : value.toLocaleString();
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function yesNo(value: boolean | null | undefined) {
  return value ? "Yes" : "No";
}

function linkName(value: { name: string | null } | null | undefined) {
  return value?.name ?? "-";
}

function formatCatalogueValue(value: unknown) {
  if (value == null || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

const specificationDefaultLabels: Array<{ key: string; label: string }> = [
  { key: "smartHomeReady", label: "Smart Home Ready" },
  { key: "highSpeedInternetReady", label: "High-Speed Internet Ready" },
  { key: "energyEfficientFixtures", label: "Energy Efficient Fixtures" },
  { key: "floorToCeilingGlass", label: "Floor-to-Ceiling Glass" },
  { key: "privateLiftAccess", label: "Private Lift Access" },
  { key: "privateLiftLobby", label: "Private Lift Lobby" },
  { key: "privatePool", label: "Private Pool" },
  { key: "privateJacuzzi", label: "Private Jacuzzi" },
  { key: "bbqArea", label: "BBQ Area" },
  { key: "entertainmentTerrace", label: "Entertainment Terrace" },
  { key: "ceilingHeight", label: "Ceiling Height" }
];

const configurationNoteLabels: Array<{ key: string; label: string }> = [
  { key: "walkInClosetNotes", label: "Walk-in Closet" },
  { key: "ensuiteMasterNotes", label: "Ensuite (Master)" },
  { key: "ensuiteBedroom2Notes", label: "Ensuite (Bedroom 2)" },
  { key: "ensuiteBedroom3Notes", label: "Ensuite (Bedroom 3)" },
  { key: "totalBathroomsNotes", label: "Total Bathrooms" },
  { key: "remarks", label: "Configuration Notes" }
];

const locationDefaultLabels: Array<{ key: string; label: string }> = [
  { key: "oceanOrientedDesign", label: "Ocean Oriented Design" },
  { key: "crossVentilation", label: "Cross Ventilation" },
  { key: "naturalDaylighting", label: "Natural Daylighting" },
  { key: "penthouseLevel", label: "Penthouse Level" },
  { key: "premiumStack", label: "Premium Stack" }
];

function blankProductForm(): ProductFormValues {
  return {
    productName: "",
    targetBuyer: "",
    typicalFloorLocation: "",
    typicalView: "",
    typicalBuyerProfile: "",
    targetRateBand: "",
    remarks: ""
  };
}

function productFormFromProduct(product: UnitProduct): ProductFormValues {
  return {
    productName: product.productName ?? "",
    targetBuyer: product.targetBuyer ?? "",
    typicalFloorLocation: product.typicalFloorLocation ?? "",
    typicalView: product.typicalView ?? "",
    typicalBuyerProfile: product.typicalBuyerProfile ?? "",
    targetRateBand: product.targetRateBand ?? "",
    remarks: product.remarks ?? ""
  };
}

function blankConfiguration(): ConfigurationFormValues {
  return Object.fromEntries(configurationFields.map((field) => [field.name, ""]).concat([["remarks", ""]])) as ConfigurationFormValues;
}

function blankArea(): AreaFormValues {
  return { ...(Object.fromEntries(areaFields.map((field) => [field.name, ""])) as Omit<AreaFormValues, "areaUom" | "remarks">), areaUom: "SQM", remarks: "" };
}

function projectPayload(values: ProjectFormValues) {
  return {
    projectCode: values.projectCode.trim(),
    name: values.name.trim(),
    locationCode: pickString(values.locationCode),
    legalEntityCode: pickString(values.legalEntityCode),
    currencyCode: pickString(values.currencyCode),
    description: pickString(values.description),
    remarks: pickString(values.remarks)
  };
}

function unitPayload(values: UnitFormValues) {
  return {
    projectId: values.projectId,
    productId: pickString(values.productId),
    applyProductDefaults: values.applyProductDefaults,
    unitCode: values.unitCode.trim(),
    unitName: pickString(values.unitName),
    blockCode: pickString(values.blockCode),
    floorNo: pickString(values.floorNo),
    inventoryCode: pickString(values.inventoryCode),
    developmentPhase: pickString(values.developmentPhase),
    buildingName: pickString(values.buildingName),
    unitTypeRefId: pickString(values.unitTypeRefId),
    unitSubTypeRefId: pickString(values.unitSubTypeRefId),
    stackRefId: pickString(values.stackRefId),
    bedroomCount: pickNumber(values.bedroomCount),
    grossArea: pickNumber(values.grossArea),
    netArea: pickNumber(values.netArea),
    basePrice: pickNumber(values.basePrice),
    currencyCode: pickString(values.currencyCode),
    availabilityStatusRefId: pickString(values.availabilityStatusRefId),
    remarks: pickString(values.remarks)
  };
}

function numberPayload<T extends Record<string, string>>(values: T, fieldNames: Array<keyof T>) {
  return Object.fromEntries(fieldNames.map((field) => [field, pickNumber(values[field])]));
}

function ReferenceSelect({
  label,
  name,
  options,
  register
}: {
  label: string;
  name: string;
  options: ReferenceDataItem[] | undefined;
  register: UseFormRegister<any>;
}) {
  return (
    <label className="crm-field">
      <span className="crm-label">{label}</span>
      <select className="crm-input" {...register(name)}>
        <option value="">Select</option>
        {(options ?? []).map((item) => (
          <option key={item.id} value={item.id}>
            {item.level2Name}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckField({ label, name, register }: { label: string; name: string; register: UseFormRegister<any> }) {
  return (
    <label className="crm-check-field">
      <input type="checkbox" {...register(name)} />
      <span>{label}</span>
    </label>
  );
}

export function InventoryPage() {
  const queryClient = useQueryClient();
  const { formatInBase, defaultContractCurrency } = useMoneyFormatter();
  const pageSize = DEFAULT_LIST_PAGE_SIZE;
  const [activeTab, setActiveTab] = useState<InventoryTab>("projects");
  const [unitDetailTab, setUnitDetailTab] = useState<UnitDetailTab>("identification");
  const [unitEditMode, setUnitEditMode] = useState(false);
  const [search, setSearch] = useState("");
  const [projectPage, setProjectPage] = useState(1);
  const [unitPage, setUnitPage] = useState(1);
  const [productPage, setProductPage] = useState(1);
  const [availabilityPage, setAvailabilityPage] = useState(1);
  const [unitListSort, setUnitListSort] = useState<ListSortState>({ sortBy: "createdAt", sortDir: "desc" });
  const [availabilityListSort, setAvailabilityListSort] = useState<ListSortState>({ sortBy: "createdAt", sortDir: "desc" });
  // "" = All statuses (default for Unit Status Register)
  const [availabilityStatusFilter, setAvailabilityStatusFilter] = useState("");
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productModalMode, setProductModalMode] = useState<ProductModalMode>("view");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const projectForm = useForm<ProjectFormValues>({
    defaultValues: { projectCode: "", name: "", locationCode: "", legalEntityCode: "", currencyCode: defaultContractCurrency, description: "", remarks: "" }
  });
  const productForm = useForm<ProductFormValues>({
    defaultValues: blankProductForm()
  });
  const unitForm = useForm<UnitFormValues>({
    defaultValues: {
      projectId: "",
      productId: "",
      applyProductDefaults: true,
      unitCode: "",
      unitName: "",
      blockCode: "",
      floorNo: "",
      inventoryCode: "",
      developmentPhase: "",
      buildingName: "",
      unitTypeRefId: "",
      unitSubTypeRefId: "",
      stackRefId: "",
      bedroomCount: "",
      grossArea: "",
      netArea: "",
      basePrice: "",
      currencyCode: defaultContractCurrency,
      availabilityStatusRefId: "",
      remarks: ""
    }
  });
  const configurationForm = useForm<ConfigurationFormValues>({ defaultValues: blankConfiguration() });
  const areaForm = useForm<AreaFormValues>({ defaultValues: blankArea() });
  const locationForm = useForm<LocationFormValues>({
    defaultValues: {
      viewTypeRefId: "",
      orientationRefId: "",
      oceanFront: false,
      oceanView: false,
      partialOceanView: false,
      gardenView: false,
      poolView: false,
      cornerUnit: false,
      endUnit: false,
      premiumStack: false,
      penthouseLevel: false,
      oceanOrientedDesign: false,
      crossVentilation: false,
      naturalDaylighting: false,
      remarks: ""
    }
  });
  const parkingForm = useForm<ParkingFormValues>({
    defaultValues: {
      parkingAllocationRefId: "",
      parkingTypeRefId: "",
      parkingBayNumber: "",
      evChargingProvision: false,
      storageAllocationRefId: "",
      storageLocker: false,
      storageLockerNumber: "",
      remarks: ""
    }
  });
  const specificationForm = useForm<SpecificationFormValues>({
    defaultValues: {
      smartHomeReady: false,
      homeAutomationPackageRefId: "",
      premiumAppliancePackageRefId: "",
      floorFinishTypeRefId: "",
      kitchenFinishTypeRefId: "",
      bathroomFinishTypeRefId: "",
      ceilingHeight: "",
      floorToCeilingGlass: false,
      highSpeedInternetReady: false,
      energyEfficientFixtures: false,
      privateLiftAccess: false,
      privateLiftLobby: false,
      privatePool: false,
      privateJacuzzi: false,
      bbqArea: false,
      entertainmentTerrace: false,
      remarks: ""
    }
  });
  const salesForm = useForm<SalesFormValues>({
    defaultValues: {
      launchDate: "",
      salesReleaseDate: "",
      baseSellingPrice: "",
      premiumAmount: "",
      discountCeilingPct: "",
      approvedSellingPrice: "",
      reservationAmount: "",
      currentMarketValue: "",
      salesStatusRefId: "",
      remarks: ""
    }
  });

  const projectsQuery = useQuery({
    queryKey: ["inventory", "projects", search, projectPage],
    queryFn: () =>
      listProjects({
        search: search || undefined,
        limit: pageSize,
        offset: (projectPage - 1) * pageSize
      }),
    staleTime: 10_000
  });
  const unitsQuery = useQuery({
    queryKey: ["inventory", "units", search, unitPage, unitListSort.sortBy, unitListSort.sortDir],
    queryFn: () =>
      listUnits({
        search: search || undefined,
        limit: pageSize,
        offset: (unitPage - 1) * pageSize,
        sortBy: unitListSort.sortBy,
        sortDir: unitListSort.sortDir
      }),
    staleTime: 10_000
  });
  const productsQuery = useQuery({
    queryKey: ["inventory", "products", search, productPage],
    queryFn: () =>
      listUnitProducts({
        search: search || undefined,
        limit: pageSize,
        offset: (productPage - 1) * pageSize
      }),
    staleTime: 10_000
  });
  const allProductsQuery = useQuery({
    queryKey: ["inventory", "products", "all"],
    queryFn: () => listUnitProducts({ limit: 100, offset: 0 }),
    staleTime: 30_000
  });
  const availabilityQuery = useQuery({
    queryKey: [
      "inventory",
      "availability",
      search,
      availabilityPage,
      availabilityStatusFilter,
      availabilityListSort.sortBy,
      availabilityListSort.sortDir
    ],
    queryFn: () =>
      listUnits({
        search: search || undefined,
        availabilityStatusRefId: availabilityStatusFilter || undefined,
        limit: pageSize,
        offset: (availabilityPage - 1) * pageSize,
        sortBy: availabilityListSort.sortBy,
        sortDir: availabilityListSort.sortDir
      }),
    staleTime: 10_000
  });
  const availabilitySummaryQuery = useQuery({
    queryKey: ["inventory", "availability-summary"],
    queryFn: () => listUnits({ limit: 1, offset: 0 }),
    staleTime: 10_000
  });

  useEffect(() => {
    setProjectPage(1);
    setUnitPage(1);
    setProductPage(1);
    setAvailabilityPage(1);
  }, [search]);

  useEffect(() => {
    setUnitPage(1);
  }, [unitListSort.sortBy, unitListSort.sortDir]);

  useEffect(() => {
    setAvailabilityPage(1);
  }, [availabilityListSort.sortBy, availabilityListSort.sortDir]);

  const onUnitSortColumn = (column: string) => {
    const preferDesc = column === "createdAt" || column === "price" || column === "area";
    setUnitListSort((current) => nextListSort(current, column, preferDesc ? "desc" : "asc"));
  };

  const onAvailabilitySortColumn = (column: string) => {
    const preferDesc = column === "createdAt" || column === "price" || column === "area";
    setAvailabilityListSort((current) => nextListSort(current, column, preferDesc ? "desc" : "asc"));
  };
  const selectedProjectQuery = useQuery({ queryKey: ["inventory", "project", selectedProjectId], queryFn: () => getProject(selectedProjectId ?? ""), enabled: Boolean(selectedProjectId) });
  const selectedUnitQuery = useQuery({ queryKey: ["inventory", "unit", selectedUnitId], queryFn: () => getUnit(selectedUnitId ?? ""), enabled: Boolean(selectedUnitId) });
  const selectedProduct = useMemo(
    () => (productsQuery.data?.items ?? []).find((item) => item.id === selectedProductId) ?? (allProductsQuery.data?.items ?? []).find((item) => item.id === selectedProductId) ?? null,
    [allProductsQuery.data?.items, productsQuery.data?.items, selectedProductId]
  );
  const unitTypesQuery = useQuery({ queryKey: ["reference", "inventory-unit-types"], queryFn: () => getReferenceFamily("INVENTORY", "UNIT_TYPE"), staleTime: 60_000 });
  const unitSubTypesQuery = useQuery({ queryKey: ["reference", "inventory-unit-sub-types"], queryFn: () => getReferenceFamily("INVENTORY", "UNIT_SUB_TYPE"), staleTime: 60_000 });
  const stacksQuery = useQuery({ queryKey: ["reference", "inventory-stacks"], queryFn: () => getReferenceFamily("INVENTORY", "STACK"), staleTime: 60_000 });
  const viewTypesQuery = useQuery({ queryKey: ["reference", "inventory-view-types"], queryFn: () => getReferenceFamily("INVENTORY", "VIEW_TYPE"), staleTime: 60_000 });
  const orientationsQuery = useQuery({ queryKey: ["reference", "inventory-orientations"], queryFn: () => getReferenceFamily("INVENTORY", "ORIENTATION"), staleTime: 60_000 });
  const parkingAllocationsQuery = useQuery({ queryKey: ["reference", "inventory-parking-allocations"], queryFn: () => getReferenceFamily("INVENTORY", "PARKING_ALLOCATION"), staleTime: 60_000 });
  const parkingTypesQuery = useQuery({ queryKey: ["reference", "inventory-parking-types"], queryFn: () => getReferenceFamily("INVENTORY", "PARKING_TYPE"), staleTime: 60_000 });
  const storageAllocationsQuery = useQuery({ queryKey: ["reference", "inventory-storage-allocations"], queryFn: () => getReferenceFamily("INVENTORY", "STORAGE_ALLOCATION"), staleTime: 60_000 });
  const finishTypesQuery = useQuery({ queryKey: ["reference", "inventory-finish-types"], queryFn: () => getReferenceFamily("INVENTORY", "FINISH_TYPE"), staleTime: 60_000 });
  const automationPackagesQuery = useQuery({ queryKey: ["reference", "inventory-automation-packages"], queryFn: () => getReferenceFamily("INVENTORY", "AUTOMATION_PACKAGE"), staleTime: 60_000 });
  const appliancePackagesQuery = useQuery({ queryKey: ["reference", "inventory-appliance-packages"], queryFn: () => getReferenceFamily("INVENTORY", "APPLIANCE_PACKAGE"), staleTime: 60_000 });
  const salesStatusesQuery = useQuery({ queryKey: ["reference", "inventory-sales-statuses"], queryFn: () => getReferenceFamily("INVENTORY", "SALES_STATUS"), staleTime: 60_000 });
  const availabilityStatusesQuery = useQuery({ queryKey: ["reference", "inventory-statuses"], queryFn: () => getReferenceFamily("INVENTORY", "STATUS"), staleTime: 60_000 });
  const blocksQuery = useQuery({ queryKey: ["reference", "inventory-blocks"], queryFn: () => getReferenceFamily("INVENTORY", "BLOCK"), staleTime: 60_000 });
  const floorsQuery = useQuery({ queryKey: ["reference", "inventory-floors"], queryFn: () => getReferenceFamily("INVENTORY", "FLOOR"), staleTime: 60_000 });
  const currenciesQuery = useQuery({ queryKey: ["currencies", "inventory-dropdown"], queryFn: () => listCurrencies({ dropdownOnly: true, activeOnly: true }), staleTime: 60_000 });

  const projectRows = projectsQuery.data?.items ?? [];
  const unitRows = unitsQuery.data?.items ?? [];
  const productRows = productsQuery.data?.items ?? [];
  const productOptions = allProductsQuery.data?.items ?? [];
  const unitPagination = unitsQuery.data?.pagination ?? { limit: pageSize, offset: 0, total: 0 };
  const availabilityRows = availabilityQuery.data?.items ?? [];
  const availabilityPagination = availabilityQuery.data?.pagination ?? { limit: pageSize, offset: 0, total: 0 };
  const availabilityStatuses = availabilityStatusesQuery.data ?? [];
  const currencyRows = currenciesQuery.data?.items ?? [];
  const selectedProject = selectedProjectQuery.data;
  const selectedUnit = selectedUnitQuery.data;
  const activeUnitDetailTab = unitDetailTabs.find((tab) => tab.id === unitDetailTab) ?? unitDetailTabs[0];

  const stats = useMemo(() => {
    const unitSummary = unitsQuery.data?.summary;
    return {
      projects: projectsQuery.data?.pagination.total ?? 0,
      units: unitsQuery.data?.pagination.total ?? 0,
      products: productsQuery.data?.pagination.total ?? allProductsQuery.data?.pagination.total ?? 0,
      available: unitSummary?.available ?? 0,
      reserved: unitSummary?.reserved ?? 0,
      value: unitSummary?.value ?? 0
    };
  }, [allProductsQuery.data?.pagination.total, productsQuery.data?.pagination.total, projectsQuery.data?.pagination.total, unitsQuery.data]);

  const availabilityStats = useMemo(() => {
    const summary = availabilitySummaryQuery.data?.summary;
    const byStatus = summary?.byStatus ?? [];
    const selectedStatus = availabilityStatuses.find((item) => item.id === availabilityStatusFilter) ?? null;
    const selectedBreakdown = selectedStatus
      ? byStatus.find((item) => item.code === selectedStatus.level2Code)
      : null;
    const selectedValue = availabilityStatusFilter
      ? (selectedBreakdown?.value ?? 0)
      : (summary?.value ?? 0);

    return {
      total: summary?.total ?? byStatus.reduce((sum, item) => sum + item.count, 0),
      byStatus,
      selectedStatusCode: selectedStatus?.level2Code ?? null,
      selectedValue
    };
  }, [availabilityStatusFilter, availabilityStatuses, availabilitySummaryQuery.data?.summary]);

  const selectAvailabilityStatus = (statusRefId: string) => {
    setAvailabilityStatusFilter(statusRefId);
    setAvailabilityPage(1);
  };

  const refreshInventory = (successMessage: string) => {
    setMessage(successMessage);
    void queryClient.invalidateQueries({ queryKey: ["inventory"] });
  };

  useEffect(() => {
    if (!selectedUnit) return;
    unitForm.reset({
      projectId: selectedUnit.project.id,
      productId: selectedUnit.product?.id ?? "",
      applyProductDefaults: false,
      unitCode: selectedUnit.unitCode,
      unitName: selectedUnit.unitName ?? "",
      blockCode: selectedUnit.blockCode ?? "",
      floorNo: selectedUnit.floorNo ?? "",
      inventoryCode: selectedUnit.inventoryCode ?? "",
      developmentPhase: selectedUnit.developmentPhase ?? "",
      buildingName: selectedUnit.buildingName ?? "",
      unitTypeRefId: selectedUnit.unitType.id ?? "",
      unitSubTypeRefId: selectedUnit.unitSubType.id ?? "",
      stackRefId: selectedUnit.stack.id ?? "",
      bedroomCount: selectedUnit.bedroomCount?.toString() ?? "",
      grossArea: selectedUnit.grossArea?.toString() ?? "",
      netArea: selectedUnit.netArea?.toString() ?? "",
      basePrice: selectedUnit.basePrice?.toString() ?? "",
      currencyCode: selectedUnit.currencyCode ?? "USD",
      availabilityStatusRefId: selectedUnit.availabilityStatus.id,
      remarks: selectedUnit.remarks ?? ""
    });

    const configuration = selectedUnit.catalogue?.configuration;
    configurationForm.reset(
      configuration
        ? Object.fromEntries(
            configurationFields.map((field) => [field.name, configuration[field.name as keyof typeof configuration]?.toString() ?? ""]).concat([["remarks", configuration.remarks ?? ""]])
          ) as ConfigurationFormValues
        : blankConfiguration()
    );

    const areaSchedule = selectedUnit.catalogue?.areaSchedule;
    areaForm.reset(
      areaSchedule
        ? {
            ...(Object.fromEntries(areaFields.map((field) => [field.name, areaSchedule[field.name as keyof typeof areaSchedule]?.toString() ?? ""])) as Omit<AreaFormValues, "areaUom" | "remarks">),
            areaUom: areaSchedule.areaUom ?? "SQM",
            remarks: areaSchedule.remarks ?? ""
          }
        : blankArea()
    );

    const location = selectedUnit.catalogue?.locationAttributes;
    locationForm.reset({
      viewTypeRefId: location?.viewType.id ?? "",
      orientationRefId: location?.orientation.id ?? "",
      oceanFront: location?.oceanFront ?? false,
      oceanView: location?.oceanView ?? false,
      partialOceanView: location?.partialOceanView ?? false,
      gardenView: location?.gardenView ?? false,
      poolView: location?.poolView ?? false,
      cornerUnit: location?.cornerUnit ?? false,
      endUnit: location?.endUnit ?? false,
      premiumStack: location?.premiumStack ?? false,
      penthouseLevel: location?.penthouseLevel ?? false,
      oceanOrientedDesign: location?.oceanOrientedDesign ?? false,
      crossVentilation: location?.crossVentilation ?? false,
      naturalDaylighting: location?.naturalDaylighting ?? false,
      remarks: location?.remarks ?? ""
    });

    const parking = selectedUnit.catalogue?.parkingStorage;
    parkingForm.reset({
      parkingAllocationRefId: parking?.parkingAllocation.id ?? "",
      parkingTypeRefId: parking?.parkingType.id ?? "",
      parkingBayNumber: parking?.parkingBayNumber ?? "",
      evChargingProvision: parking?.evChargingProvision ?? false,
      storageAllocationRefId: parking?.storageAllocation.id ?? "",
      storageLocker: parking?.storageLocker ?? false,
      storageLockerNumber: parking?.storageLockerNumber ?? "",
      remarks: parking?.remarks ?? ""
    });

    const specification = selectedUnit.catalogue?.specification;
    specificationForm.reset({
      smartHomeReady: specification?.smartHomeReady ?? false,
      homeAutomationPackageRefId: specification?.homeAutomationPackage.id ?? "",
      premiumAppliancePackageRefId: specification?.premiumAppliancePackage.id ?? "",
      floorFinishTypeRefId: specification?.floorFinishType.id ?? "",
      kitchenFinishTypeRefId: specification?.kitchenFinishType.id ?? "",
      bathroomFinishTypeRefId: specification?.bathroomFinishType.id ?? "",
      ceilingHeight: specification?.ceilingHeight ?? "",
      floorToCeilingGlass: specification?.floorToCeilingGlass ?? false,
      highSpeedInternetReady: specification?.highSpeedInternetReady ?? false,
      energyEfficientFixtures: specification?.energyEfficientFixtures ?? false,
      privateLiftAccess: specification?.privateLiftAccess ?? false,
      privateLiftLobby: specification?.privateLiftLobby ?? false,
      privatePool: specification?.privatePool ?? false,
      privateJacuzzi: specification?.privateJacuzzi ?? false,
      bbqArea: specification?.bbqArea ?? false,
      entertainmentTerrace: specification?.entertainmentTerrace ?? false,
      remarks: specification?.remarks ?? ""
    });

    const sales = selectedUnit.catalogue?.salesInformation;
    salesForm.reset({
      launchDate: sales?.launchDate ?? "",
      salesReleaseDate: sales?.salesReleaseDate ?? "",
      baseSellingPrice: sales?.baseSellingPrice?.toString() ?? "",
      premiumAmount: sales?.premiumAmount?.toString() ?? "",
      discountCeilingPct: sales?.discountCeilingPct?.toString() ?? "",
      approvedSellingPrice: sales?.approvedSellingPrice?.toString() ?? "",
      reservationAmount: sales?.reservationAmount?.toString() ?? "",
      currentMarketValue: sales?.currentMarketValue?.toString() ?? "",
      salesStatusRefId: sales?.salesStatus.id ?? "",
      remarks: sales?.remarks ?? ""
    });
  }, [areaForm, configurationForm, locationForm, parkingForm, salesForm, selectedUnit, specificationForm, unitForm]);

  const createProjectMutation = useMutation({
    mutationFn: (values: ProjectFormValues) => createProject(projectPayload(values)),
    onSuccess: () => {
      setProjectModalOpen(false);
      setSelectedProjectId(null);
      projectForm.reset({ projectCode: "", name: "", locationCode: "", legalEntityCode: "", currencyCode: defaultContractCurrency, description: "", remarks: "" });
      refreshInventory("Project saved.");
    },
    onError: () => setMessage("Project could not be saved. Check code and required fields.")
  });
  const updateProjectMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ProjectFormValues }) => updateProject(id, projectPayload(values)),
    onSuccess: (project) => {
      setSelectedProjectId(project.id);
      setProjectModalOpen(false);
      refreshInventory("Project updated.");
    },
    onError: () => setMessage("Project could not be updated.")
  });
  const createUnitMutation = useMutation({
    mutationFn: (values: UnitFormValues) => createUnit(unitPayload(values)),
    onSuccess: (unit) => {
      setSelectedUnitId(unit.id);
      refreshInventory("Unit saved.");
    },
    onError: () => setMessage("Unit could not be saved. Check project, unit code, and status.")
  });
  const updateUnitMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: UnitFormValues }) => updateUnit(id, unitPayload(values)),
    onSuccess: (unit) => {
      setSelectedUnitId(unit.id);
      refreshInventory("Unit updated.");
    },
    onError: () => setMessage("Unit could not be updated.")
  });
  const applyProductMutation = useMutation({
    mutationFn: ({ unitId, productId }: { unitId: string; productId: string }) => applyUnitProduct(unitId, productId),
    onSuccess: (unit) => {
      setSelectedUnitId(unit.id);
      refreshInventory("Product defaults applied to unit.");
    },
    onError: () => setMessage("Product defaults could not be applied.")
  });
  const updateProductMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ProductFormValues }) =>
      updateUnitProduct(id, {
        productName: values.productName.trim(),
        targetBuyer: pickString(values.targetBuyer),
        typicalFloorLocation: pickString(values.typicalFloorLocation),
        typicalView: pickString(values.typicalView),
        typicalBuyerProfile: pickString(values.typicalBuyerProfile),
        targetRateBand: pickString(values.targetRateBand),
        remarks: pickString(values.remarks)
      }),
    onSuccess: (product) => {
      setSelectedProductId(product.id);
      setProductModalMode("view");
      productForm.reset(productFormFromProduct(product));
      refreshInventory("Product updated.");
    },
    onError: () => setMessage("Product could not be updated.")
  });

  const sectionMutation = useMutation({
    mutationFn: ({ section, id, values }: { section: UnitDetailTab; id: string; values: any }) => {
      switch (section) {
        case "configuration":
          return upsertUnitConfiguration(id, { ...numberPayload(values, configurationFields.map((field) => field.name)), remarks: pickString(values.remarks) });
        case "area":
          return upsertUnitAreaSchedule(id, { ...numberPayload(values, areaFields.map((field) => field.name)), areaUom: values.areaUom, remarks: pickString(values.remarks) });
        case "location":
          return upsertUnitLocationAttributes(id, { ...values, viewTypeRefId: pickString(values.viewTypeRefId), orientationRefId: pickString(values.orientationRefId), remarks: pickString(values.remarks) });
        case "parking":
          return upsertUnitParkingStorage(id, {
            ...values,
            parkingAllocationRefId: pickString(values.parkingAllocationRefId),
            parkingTypeRefId: pickString(values.parkingTypeRefId),
            parkingBayNumber: pickString(values.parkingBayNumber),
            storageAllocationRefId: pickString(values.storageAllocationRefId),
            storageLockerNumber: pickString(values.storageLockerNumber),
            remarks: pickString(values.remarks)
          });
        case "specification":
          return upsertUnitSpecification(id, {
            ...values,
            homeAutomationPackageRefId: pickString(values.homeAutomationPackageRefId),
            premiumAppliancePackageRefId: pickString(values.premiumAppliancePackageRefId),
            floorFinishTypeRefId: pickString(values.floorFinishTypeRefId),
            kitchenFinishTypeRefId: pickString(values.kitchenFinishTypeRefId),
            bathroomFinishTypeRefId: pickString(values.bathroomFinishTypeRefId),
            ceilingHeight: pickString(values.ceilingHeight),
            remarks: pickString(values.remarks)
          });
        case "sales":
          return upsertUnitSalesInformation(id, {
            launchDate: pickString(values.launchDate),
            salesReleaseDate: pickString(values.salesReleaseDate),
            baseSellingPrice: pickNumber(values.baseSellingPrice),
            premiumAmount: pickNumber(values.premiumAmount),
            discountCeilingPct: pickNumber(values.discountCeilingPct),
            approvedSellingPrice: pickNumber(values.approvedSellingPrice),
            reservationAmount: pickNumber(values.reservationAmount),
            currentMarketValue: pickNumber(values.currentMarketValue),
            salesStatusRefId: pickString(values.salesStatusRefId),
            remarks: pickString(values.remarks)
          });
        default:
          return Promise.reject(new Error("Unsupported section"));
      }
    },
    onSuccess: (unit) => {
      setSelectedUnitId(unit.id);
      refreshInventory("Unit catalogue updated.");
    },
    onError: () => setMessage("Unit catalogue section could not be updated.")
  });

  const onProjectSubmit = projectForm.handleSubmit((values) => {
    if (!values.projectCode.trim() || !values.name.trim()) {
      setMessage("Project code and name are required.");
      return;
    }
    if (selectedProject) updateProjectMutation.mutate({ id: selectedProject.id, values });
    else createProjectMutation.mutate(values);
  });

  const onUnitSubmit = unitForm.handleSubmit((values) => {
    if (!values.projectId || !values.unitCode.trim()) {
      setMessage("Project and unit code are required.");
      return;
    }
    if (selectedUnit && activeTab === "units") updateUnitMutation.mutate({ id: selectedUnit.id, values });
    else createUnitMutation.mutate(values);
  });

  const saveSection = (section: UnitDetailTab, values: any) => {
    if (!selectedUnit) {
      setMessage("Select a unit before saving catalogue details.");
      return;
    }
    sectionMutation.mutate({ section, id: selectedUnit.id, values });
  };

  const loadProjectForm = (project: Project) => {
    setSelectedProjectId(project.id);
    projectForm.reset({
      projectCode: project.projectCode,
      name: project.name,
      locationCode: project.locationCode ?? "",
      legalEntityCode: project.legalEntityCode ?? "",
      currencyCode: project.currencyCode ?? defaultContractCurrency,
      description: project.description ?? "",
      remarks: project.remarks ?? ""
    });
    setProjectModalOpen(true);
  };

  const openNewProjectModal = () => {
    setSelectedProjectId(null);
    projectForm.reset({
      projectCode: "",
      name: "",
      locationCode: "",
      legalEntityCode: "",
      currencyCode: defaultContractCurrency,
      description: "",
      remarks: ""
    });
    setProjectModalOpen(true);
  };

  const closeProjectModal = () => {
    setProjectModalOpen(false);
  };

  useModalEscape(projectModalOpen, closeProjectModal);
  useModalEscape(unitModalOpen, () => setUnitModalOpen(false));
  useModalEscape(productModalOpen, () => {
    setProductModalOpen(false);
    setProductModalMode("view");
  });

  const openProductModal = (product: UnitProduct, mode: ProductModalMode) => {
    setSelectedProductId(product.id);
    setProductModalMode(mode);
    productForm.reset(productFormFromProduct(product));
    setProductModalOpen(true);
  };

  const closeProductModal = () => {
    setProductModalOpen(false);
    setProductModalMode("view");
  };

  const onProductSubmit = productForm.handleSubmit((values) => {
    if (!selectedProduct) return;
    if (!values.productName.trim()) {
      setMessage("Product name is required.");
      return;
    }
    updateProductMutation.mutate({ id: selectedProduct.id, values });
  });

  const loadUnitForm = (unit: Unit) => {
    setActiveTab("units");
    setSelectedUnitId(unit.id);
    setUnitDetailTab("identification");
    setUnitEditMode(false);
    setUnitModalOpen(true);
  };

  const resetUnitForm = () => {
    setSelectedUnitId(null);
    setUnitDetailTab("identification");
    setUnitEditMode(true);
    setUnitModalOpen(true);
    unitForm.reset({
      projectId: "",
      productId: "",
      applyProductDefaults: true,
      unitCode: "",
      unitName: "",
      blockCode: "",
      floorNo: "",
      inventoryCode: "",
      developmentPhase: "",
      buildingName: "",
      unitTypeRefId: "",
      unitSubTypeRefId: "",
      stackRefId: "",
      bedroomCount: "",
      grossArea: "",
      netArea: "",
      basePrice: "",
      currencyCode: defaultContractCurrency,
      availabilityStatusRefId: "",
      remarks: ""
    });
  };

  const renderUnitSectionView = () => {
    if (!selectedUnit) return <p className="crm-muted-text">Create the unit first, then complete catalogue details.</p>;

    const catalogue = selectedUnit.catalogue;
    const configuration = catalogue?.configuration;
    const areaSchedule = catalogue?.areaSchedule;
    const location = catalogue?.locationAttributes;
    const parking = catalogue?.parkingStorage;
    const specification = catalogue?.specification;
    const sales = catalogue?.salesInformation;

    if (unitDetailTab === "identification") {
      return (
        <dl className="crm-detail-list crm-unit-view-grid">
          <div><dt>Project</dt><dd>{selectedUnit.project.projectCode} - {selectedUnit.project.name ?? "-"}</dd></div>
          <div><dt>Product</dt><dd>{selectedUnit.product ? `${selectedUnit.product.code ?? "-"} · ${selectedUnit.product.name ?? "-"}` : "-"}</dd></div>
          <div><dt>Unit</dt><dd>{selectedUnit.unitCode}</dd></div>
          <div><dt>Unit Name</dt><dd>{selectedUnit.unitName ?? "-"}</dd></div>
          <div><dt>Inventory Code</dt><dd>{selectedUnit.inventoryCode ?? "-"}</dd></div>
          <div><dt>Phase</dt><dd>{selectedUnit.developmentPhase ?? "-"}</dd></div>
          <div><dt>Building</dt><dd>{selectedUnit.buildingName ?? "-"}</dd></div>
          <div><dt>Block / Floor</dt><dd>{selectedUnit.blockCode ?? "-"} / {selectedUnit.floorNo ?? "-"}</dd></div>
          <div><dt>Type</dt><dd>{linkName(selectedUnit.unitType)} / {linkName(selectedUnit.unitSubType)}</dd></div>
          <div><dt>Stack</dt><dd>{linkName(selectedUnit.stack)}</dd></div>
          <div><dt>Area</dt><dd>{area(selectedUnit.netArea)} net / {area(selectedUnit.grossArea)} gross</dd></div>
          <div><dt>Price</dt><dd>{formatInBase(selectedUnit.basePrice, selectedUnit.currencyCode)}</dd></div>
          <div><dt>Status</dt><dd>{linkName(selectedUnit.availabilityStatus)}</dd></div>
          {selectedUnit.salesVelocityTag ? (
            <div className="crm-field-span-all">
              <dt>Sales Velocity</dt>
              <dd><UnitVelocityBadge tag={selectedUnit.salesVelocityTag} /></dd>
            </div>
          ) : null}
        </dl>
      );
    }

    if (unitDetailTab === "configuration") {
      return (
        <dl className="crm-detail-list crm-unit-view-grid">
          {configurationFields.map((field) => (
            <div key={field.name}><dt>{field.label}</dt><dd>{configuration?.[field.name as keyof typeof configuration] ?? "-"}</dd></div>
          ))}
          <div><dt>Remarks</dt><dd>{configuration?.remarks ?? "-"}</dd></div>
        </dl>
      );
    }

    if (unitDetailTab === "area") {
      return (
        <dl className="crm-detail-list crm-unit-view-grid">
          <div><dt>Area UOM</dt><dd>{areaSchedule?.areaUom ?? "-"}</dd></div>
          {areaFields.map((field) => (
            <div key={field.name}><dt>{field.label}</dt><dd>{areaSchedule?.[field.name as keyof typeof areaSchedule] ?? "-"}</dd></div>
          ))}
          <div><dt>Remarks</dt><dd>{areaSchedule?.remarks ?? "-"}</dd></div>
        </dl>
      );
    }

    if (unitDetailTab === "location") {
      return (
        <dl className="crm-detail-list crm-unit-view-grid">
          <div><dt>View Type</dt><dd>{linkName(location?.viewType)}</dd></div>
          <div><dt>Orientation</dt><dd>{linkName(location?.orientation)}</dd></div>
          <div><dt>Ocean Front</dt><dd>{yesNo(location?.oceanFront)}</dd></div>
          <div><dt>Ocean View</dt><dd>{yesNo(location?.oceanView)}</dd></div>
          <div><dt>Partial Ocean View</dt><dd>{yesNo(location?.partialOceanView)}</dd></div>
          <div><dt>Garden View</dt><dd>{yesNo(location?.gardenView)}</dd></div>
          <div><dt>Pool View</dt><dd>{yesNo(location?.poolView)}</dd></div>
          <div><dt>Corner Unit</dt><dd>{yesNo(location?.cornerUnit)}</dd></div>
          <div><dt>End Unit</dt><dd>{yesNo(location?.endUnit)}</dd></div>
          <div><dt>Premium Stack</dt><dd>{yesNo(location?.premiumStack)}</dd></div>
          <div><dt>Penthouse Level</dt><dd>{yesNo(location?.penthouseLevel)}</dd></div>
          <div><dt>Ocean Oriented Design</dt><dd>{yesNo(location?.oceanOrientedDesign)}</dd></div>
          <div><dt>Cross Ventilation</dt><dd>{yesNo(location?.crossVentilation)}</dd></div>
          <div><dt>Natural Daylighting</dt><dd>{yesNo(location?.naturalDaylighting)}</dd></div>
          <div><dt>Remarks</dt><dd>{location?.remarks ?? "-"}</dd></div>
        </dl>
      );
    }

    if (unitDetailTab === "parking") {
      return (
        <dl className="crm-detail-list crm-unit-view-grid">
          <div><dt>Parking Allocation</dt><dd>{linkName(parking?.parkingAllocation)}</dd></div>
          <div><dt>Parking Type</dt><dd>{linkName(parking?.parkingType)}</dd></div>
          <div><dt>Parking Bay</dt><dd>{parking?.parkingBayNumber ?? "-"}</dd></div>
          <div><dt>EV Charging</dt><dd>{yesNo(parking?.evChargingProvision)}</dd></div>
          <div><dt>Storage Allocation</dt><dd>{linkName(parking?.storageAllocation)}</dd></div>
          <div><dt>Storage Locker</dt><dd>{yesNo(parking?.storageLocker)}</dd></div>
          <div><dt>Locker Number</dt><dd>{parking?.storageLockerNumber ?? "-"}</dd></div>
          <div><dt>Remarks</dt><dd>{parking?.remarks ?? "-"}</dd></div>
        </dl>
      );
    }

    if (unitDetailTab === "specification") {
      return (
        <dl className="crm-detail-list crm-unit-view-grid">
          <div><dt>Automation Package</dt><dd>{linkName(specification?.homeAutomationPackage)}</dd></div>
          <div><dt>Appliance Package</dt><dd>{linkName(specification?.premiumAppliancePackage)}</dd></div>
          <div><dt>Floor Finish</dt><dd>{linkName(specification?.floorFinishType)}</dd></div>
          <div><dt>Kitchen Finish</dt><dd>{linkName(specification?.kitchenFinishType)}</dd></div>
          <div><dt>Bathroom Finish</dt><dd>{linkName(specification?.bathroomFinishType)}</dd></div>
          <div><dt>Ceiling Height</dt><dd>{specification?.ceilingHeight ?? "-"}</dd></div>
          <div><dt>Smart Home Ready</dt><dd>{yesNo(specification?.smartHomeReady)}</dd></div>
          <div><dt>Floor-to-Ceiling Glass</dt><dd>{yesNo(specification?.floorToCeilingGlass)}</dd></div>
          <div><dt>Private Lift</dt><dd>{yesNo(specification?.privateLiftAccess)}</dd></div>
          <div><dt>Private Pool</dt><dd>{yesNo(specification?.privatePool)}</dd></div>
          <div><dt>Remarks</dt><dd>{specification?.remarks ?? "-"}</dd></div>
        </dl>
      );
    }

    if (unitDetailTab === "sales") {
      return (
        <dl className="crm-detail-list crm-unit-view-grid">
          <div><dt>Launch Date</dt><dd>{sales?.launchDate ?? "-"}</dd></div>
          <div><dt>Sales Release Date</dt><dd>{sales?.salesReleaseDate ?? "-"}</dd></div>
          {selectedUnit.salesVelocityTag ? (
            <div className="crm-field-span-all">
              <dt>Sales Velocity Tag</dt>
              <dd><UnitVelocityBadge tag={selectedUnit.salesVelocityTag} /></dd>
            </div>
          ) : null}
          <div><dt>Base Selling Price</dt><dd>{formatInBase(sales?.baseSellingPrice ?? null, selectedUnit.currencyCode)}</dd></div>
          <div><dt>Premium Amount</dt><dd>{formatInBase(sales?.premiumAmount ?? null, selectedUnit.currencyCode)}</dd></div>
          <div><dt>Discount Ceiling %</dt><dd>{sales?.discountCeilingPct ?? "-"}</dd></div>
          <div><dt>Approved Selling Price</dt><dd>{formatInBase(sales?.approvedSellingPrice ?? null, selectedUnit.currencyCode)}</dd></div>
          <div><dt>Reservation Amount</dt><dd>{formatInBase(sales?.reservationAmount ?? null, selectedUnit.currencyCode)}</dd></div>
          <div><dt>Current Market Value</dt><dd>{formatInBase(sales?.currentMarketValue ?? null, selectedUnit.currencyCode)}</dd></div>
          <div><dt>Sales Status</dt><dd>{sales?.salesStatus?.name ?? "-"}</dd></div>
          <div><dt>Remarks</dt><dd>{sales?.remarks ?? "-"}</dd></div>
        </dl>
      );
    }

    return (
      <div className="crm-linked-module-grid">
        <article><strong>Reservation</strong><span>{selectedUnit.reservationStatus.name ?? "No active reservation"}</span></article>
        <article><strong>SPA / Contract</strong><span>Linked from Contracts workspace</span></article>
        <article><strong>Collections</strong><span>Separate management module planned</span></article>
        <article><strong>Handover</strong><span>Separate management module planned</span></article>
        <article><strong>Title Transfer</strong><span>Separate management module planned</span></article>
        <article><strong>Investor Reporting</strong><span>Separate BI/reporting module planned</span></article>
      </div>
    );
  };

  return (
    <div className="crm-workspace">
      <section className="crm-module-header">
        <div>
          <p className="crm-eyebrow">Inventory</p>
          <div className="crm-dashboard-title-row">
            <h2>Projects and Units</h2>
            <CurrencyBadge />
          </div>
        </div>
      </section>

      <section className={`crm-grid crm-metric-grid${activeTab === "availability" ? " crm-unit-status-metric-grid" : ""}`}>
        {activeTab === "availability" ? (
          <>
            <button
              className={`crm-card crm-metric-card-button${!availabilityStatusFilter ? " is-selected" : ""}`}
              onClick={() => selectAvailabilityStatus("")}
              type="button"
            >
              <h3>All</h3>
              <div className="crm-kpi">{availabilityStats.total}</div>
            </button>
            {availabilityStatuses.map((status) => {
              const count = availabilityStats.byStatus.find((item) => item.code === status.level2Code)?.count ?? 0;
              const isSelected = availabilityStatusFilter === status.id;
              return (
                <button
                  aria-pressed={isSelected}
                  className={`crm-card crm-metric-card-button${isSelected ? " is-selected" : ""}`}
                  key={status.id}
                  onClick={() => selectAvailabilityStatus(status.id)}
                  type="button"
                >
                  <h3>{status.level2Name}</h3>
                  <div className="crm-kpi">{count}</div>
                </button>
              );
            })}
            <article className="crm-card crm-metric-value-card is-selected">
              <h3>
                Value
                {availabilityStatusFilter
                  ? ` · ${availabilityStatuses.find((status) => status.id === availabilityStatusFilter)?.level2Name ?? "Selected"}`
                  : " · All"}
              </h3>
              <div className="crm-kpi">{formatInBase(availabilityStats.selectedValue)}</div>
            </article>
          </>
        ) : (
          <>
            <article className="crm-card"><h3>Projects</h3><div className="crm-kpi">{stats.projects}</div></article>
            <article className="crm-card"><h3>Products</h3><div className="crm-kpi">{stats.products}</div></article>
            <article className="crm-card"><h3>Units</h3><div className="crm-kpi">{stats.units}</div></article>
            <article className="crm-card"><h3>Available</h3><div className="crm-kpi">{stats.available}</div></article>
            <article className="crm-card"><h3>Value</h3><div className="crm-kpi">{formatInBase(stats.value)}</div></article>
          </>
        )}
      </section>

      {message ? <div className={message.includes("could not") ? "crm-error-banner" : "crm-info-banner"}>{message}</div> : null}

      <section className="crm-tabs" aria-label="Inventory management tabs">
        {[
          { id: "projects", label: "Projects" },
          { id: "products", label: "Products" },
          { id: "units", label: "Units" },
          { id: "availability", label: "Unit Status" }
        ].map((tab) => (
          <button className={`crm-tab-button${activeTab === tab.id ? " is-active" : ""}`} key={tab.id} onClick={() => setActiveTab(tab.id as InventoryTab)} type="button">
            {tab.label}
          </button>
        ))}
      </section>

      {activeTab === "projects" ? (
        <section className="crm-panel">
          <div className="crm-panel-header">
            <h3>Project Register</h3>
            <div className="crm-unit-register-actions">
              <input className="crm-input crm-search-input" onChange={(event) => setSearch(event.target.value)} placeholder="Search project, location" value={search} />
              <button className="crm-primary-button" onClick={openNewProjectModal} type="button">
                New Project
              </button>
            </div>
          </div>
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead><tr><th>Project</th><th>Location</th><th>Currency</th><th>Status</th><th>Act.</th></tr></thead>
              <tbody>
                {projectRows.map((project) => (
                  <tr key={project.id}>
                    <td><strong>{project.projectCode}</strong><span>{project.name}</span></td>
                    <td>{project.locationCode ?? "-"}</td>
                    <td>{project.currencyCode ?? "-"}</td>
                    <td>{project.status}</td>
                    <td>
                      <button className="crm-secondary-button crm-small-button" onClick={() => loadProjectForm(project)} type="button">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPagination
            page={projectPage}
            pageSize={pageSize}
            total={projectsQuery.data?.pagination.total ?? 0}
            itemLabel="projects"
            onPageChange={setProjectPage}
          />
        </section>
      ) : null}

      {activeTab === "products" ? (
        <section className="crm-unit-workspace">
          <section className="crm-panel crm-unit-register-panel">
            <div className="crm-panel-header">
              <h3>Unit Product Catalogue</h3>
              <div className="crm-unit-register-actions">
                <input
                  className="crm-input crm-search-input"
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setProductPage(1);
                  }}
                  placeholder="Search product code or name"
                  value={search}
                />
              </div>
            </div>
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Type</th>
                    <th>Beds</th>
                    <th>Parking</th>
                    <th>Positioning</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((product) => (
                    <tr className={selectedProductId === product.id && productModalOpen ? "is-selected" : ""} key={product.id}>
                      <td>
                        <strong>{product.productCode}</strong>
                        <span>{product.productName}</span>
                      </td>
                      <td>{product.unitType.name ?? "-"}</td>
                      <td>{product.bedroomCount ?? "-"}</td>
                      <td>
                        {product.parkingBaysMin ?? "-"}
                        {product.parkingBaysMax != null && product.parkingBaysMax !== product.parkingBaysMin ? `-${product.parkingBaysMax}` : ""} bay
                        {product.parkingPricingMode.name ? ` · ${product.parkingPricingMode.name}` : ""}
                      </td>
                      <td>{product.marketPositioning.name ?? "-"}</td>
                      <td>
                        <div className="crm-dashboard-actions">
                          <button className="crm-secondary-button crm-small-button" onClick={() => openProductModal(product, "view")} type="button">
                            View
                          </button>
                          <button className="crm-secondary-button crm-small-button" onClick={() => openProductModal(product, "edit")} type="button">
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {productRows.length === 0 ? (
                    <tr>
                      <td className="crm-empty-cell" colSpan={6}>
                        No products found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <ListPagination
              page={productPage}
              pageSize={pageSize}
              total={productsQuery.data?.pagination.total ?? 0}
              itemLabel="products"
              onPageChange={setProductPage}
            />
          </section>
        </section>
      ) : null}

      {activeTab === "availability" ? (
        <section className="crm-unit-workspace">
          <section className="crm-panel crm-unit-register-panel">
            <div className="crm-panel-header">
              <div>
                <h3>Unit Status Register</h3>
                <p className="crm-muted-text">View units by status across the full stock. Manage unit details from the Units tab.</p>
              </div>
              <div className="crm-unit-register-actions">
                <select
                  className="crm-input"
                  onChange={(event) => {
                    selectAvailabilityStatus(event.target.value);
                  }}
                  value={availabilityStatusFilter}
                >
                  <option value="">All</option>
                  {availabilityStatuses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.level2Name}
                    </option>
                  ))}
                </select>
                <input
                  className="crm-input crm-search-input"
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setAvailabilityPage(1);
                  }}
                  placeholder="Search unit or project"
                  value={search}
                />
              </div>
            </div>
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <SortableTh
                      column="unit"
                      label="Unit"
                      onSort={onAvailabilitySortColumn}
                      sortBy={availabilityListSort.sortBy}
                      sortDir={availabilityListSort.sortDir}
                    />
                    <SortableTh
                      column="project"
                      label="Project"
                      onSort={onAvailabilitySortColumn}
                      sortBy={availabilityListSort.sortBy}
                      sortDir={availabilityListSort.sortDir}
                    />
                    <SortableTh
                      column="type"
                      label="Type"
                      onSort={onAvailabilitySortColumn}
                      sortBy={availabilityListSort.sortBy}
                      sortDir={availabilityListSort.sortDir}
                    />
                    <SortableTh
                      column="block"
                      label="Block / Floor"
                      onSort={onAvailabilitySortColumn}
                      sortBy={availabilityListSort.sortBy}
                      sortDir={availabilityListSort.sortDir}
                    />
                    <SortableTh
                      column="area"
                      label="Area"
                      onSort={onAvailabilitySortColumn}
                      sortBy={availabilityListSort.sortBy}
                      sortDir={availabilityListSort.sortDir}
                    />
                    <SortableTh
                      column="price"
                      label="Price"
                      onSort={onAvailabilitySortColumn}
                      sortBy={availabilityListSort.sortBy}
                      sortDir={availabilityListSort.sortDir}
                    />
                    <SortableTh
                      column="status"
                      label="Status"
                      onSort={onAvailabilitySortColumn}
                      sortBy={availabilityListSort.sortBy}
                      sortDir={availabilityListSort.sortDir}
                    />
                    <SortableTh
                      column="createdAt"
                      label="Created Date"
                      onSort={onAvailabilitySortColumn}
                      sortBy={availabilityListSort.sortBy}
                      sortDir={availabilityListSort.sortDir}
                    />
                  </tr>
                </thead>
                <tbody>
                  {availabilityRows.map((unit) => (
                    <tr key={unit.id}>
                      <td><strong>{unit.unitCode}</strong><span>{unit.unitName ?? "Unit"}</span></td>
                      <td><strong>{unit.project.projectCode}</strong><span>{unit.project.name ?? "-"}</span></td>
                      <td>{unit.unitType.name ?? "-"}</td>
                      <td>{unit.blockCode ?? "-"} / {unit.floorNo ?? "-"}</td>
                      <td>{area(unit.netArea)}</td>
                      <td>{formatInBase(unit.basePrice, unit.currencyCode)}</td>
                      <td><span className={`crm-status-pill crm-status-${unit.availabilityStatus.code?.toLowerCase() ?? "default"}`}>{unit.availabilityStatus.name ?? unit.status}</span></td>
                      <td>{formatDate(unit.createdAt)}</td>
                    </tr>
                  ))}
                  {availabilityRows.length === 0 ? (
                    <tr>
                      <td className="crm-empty-cell" colSpan={8}>
                        {availabilityQuery.isLoading ? "Loading unit status..." : "No units found for this status."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <ListPagination
              page={availabilityPage}
              pageSize={pageSize}
              total={availabilityPagination.total}
              itemLabel="units"
              onPageChange={setAvailabilityPage}
            />
          </section>
        </section>
      ) : null}

      {activeTab === "units" ? (
        <section className="crm-unit-workspace">
          <section className="crm-panel crm-unit-register-panel">
            <div className="crm-panel-header">
              <h3>Unit Register</h3>
              <div className="crm-unit-register-actions">
                <input
                  className="crm-input crm-search-input"
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setUnitPage(1);
                  }}
                  placeholder="Search unit, project, status"
                  value={search}
                />
                <button className="crm-primary-button" onClick={resetUnitForm} type="button">
                  New Unit
                </button>
              </div>
            </div>
            <div className="crm-table-wrap">
              <table className="crm-table crm-unit-register-table">
                <thead>
                  <tr>
                    <SortableTh
                      column="unit"
                      label="Unit"
                      onSort={onUnitSortColumn}
                      sortBy={unitListSort.sortBy}
                      sortDir={unitListSort.sortDir}
                    />
                    <SortableTh
                      column="project"
                      label="Project"
                      onSort={onUnitSortColumn}
                      sortBy={unitListSort.sortBy}
                      sortDir={unitListSort.sortDir}
                    />
                    <SortableTh
                      column="product"
                      label="Product"
                      onSort={onUnitSortColumn}
                      sortBy={unitListSort.sortBy}
                      sortDir={unitListSort.sortDir}
                    />
                    <SortableTh
                      column="type"
                      label="Type"
                      onSort={onUnitSortColumn}
                      sortBy={unitListSort.sortBy}
                      sortDir={unitListSort.sortDir}
                    />
                    <SortableTh
                      column="area"
                      label="Area"
                      onSort={onUnitSortColumn}
                      sortBy={unitListSort.sortBy}
                      sortDir={unitListSort.sortDir}
                    />
                    <SortableTh
                      column="price"
                      label="Price"
                      onSort={onUnitSortColumn}
                      sortBy={unitListSort.sortBy}
                      sortDir={unitListSort.sortDir}
                    />
                    <SortableTh
                      column="status"
                      label="Status"
                      onSort={onUnitSortColumn}
                      sortBy={unitListSort.sortBy}
                      sortDir={unitListSort.sortDir}
                    />
                    <SortableTh
                      column="createdAt"
                      label="Created Date"
                      onSort={onUnitSortColumn}
                      sortBy={unitListSort.sortBy}
                      sortDir={unitListSort.sortDir}
                    />
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {unitRows.map((unit) => (
                    <tr className={selectedUnitId === unit.id ? "is-selected" : ""} key={unit.id}>
                      <td><strong>{unit.unitCode}</strong><span>{unit.unitName ?? "Unit"}</span></td>
                      <td><strong>{unit.project.projectCode}</strong><span>{unit.project.name ?? "-"}</span></td>
                      <td>{unit.product?.code ?? "-"}</td>
                      <td>{unit.unitType.name ?? "-"}</td>
                      <td>{area(unit.netArea)}</td>
                      <td>{formatInBase(unit.basePrice, unit.currencyCode)}</td>
                      <td><span className={`crm-status-pill crm-status-${unit.availabilityStatus.code?.toLowerCase() ?? "default"}`}>{unit.availabilityStatus.name ?? unit.status}</span></td>
                      <td>{formatDate(unit.createdAt)}</td>
                      <td>
                        <button className="crm-secondary-button crm-small-button" onClick={() => loadUnitForm(unit)} type="button">
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                  {unitRows.length === 0 ? (
                    <tr>
                      <td className="crm-empty-cell" colSpan={9}>
                        No units found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <ListPagination
              page={unitPage}
              pageSize={pageSize}
              total={unitPagination.total}
              itemLabel="units"
              onPageChange={setUnitPage}
            />
          </section>

          {unitModalOpen ? (
            <div className="crm-modal-backdrop" role="presentation">
          <section aria-modal="true" className="crm-modal crm-unit-detail-modal crm-unit-catalogue-panel" role="dialog">
            <div className="crm-panel-header">
              <div>
                <h3>{selectedUnit ? selectedUnit.unitCode : "Create Unit"}</h3>
                <p className="crm-muted-text">
                  {selectedUnit
                    ? `${selectedUnit.project.projectCode ?? "-"} · ${selectedUnit.unitName ?? "Unit"}`
                    : "Create the unit first, then complete catalogue sections."}
                </p>
                {selectedUnit?.salesVelocityTag ? <UnitVelocityBadge tag={selectedUnit.salesVelocityTag} /> : null}
              </div>
              <div className="crm-modal-header-actions">
                <CurrencyBadge compact />
                <button className="crm-secondary-button crm-fit-button" onClick={resetUnitForm} type="button">New</button>
                <button className="crm-secondary-button crm-fit-button" onClick={() => setUnitModalOpen(false)} type="button">Close</button>
              </div>
            </div>

            <div className="crm-unit-builder">
              <aside className="crm-unit-section-rail" aria-label="Unit detail sections">
                {unitDetailTabs.map((tab) => (
                  <button
                    className={`crm-unit-section-button${unitDetailTab === tab.id ? " is-active" : ""}`}
                    key={tab.id}
                    onClick={() => {
                      setUnitDetailTab(tab.id);
                      setUnitEditMode(!selectedUnit);
                    }}
                    type="button"
                  >
                    <span>{tab.label}</span>
                    <small>{unitDetailTab === tab.id ? (unitEditMode ? "Editing" : "View") : "Open"}</small>
                  </button>
                ))}
              </aside>
              <section className="crm-unit-section-panel">
                <div className="crm-unit-section-heading">
                  <div>
                    <h4>{activeUnitDetailTab.label}</h4>
                    <p className="crm-muted-text">
                      {unitDetailTab === "linked" ? "Review downstream modules connected to this unit." : "Complete this section, then continue with the next unit detail section."}
                    </p>
                  </div>
                  <div className="crm-dashboard-actions">
                    <span className="crm-status-pill crm-status-available">{selectedUnit ? (unitEditMode ? "Editing" : "View Mode") : "New Unit"}</span>
                    {selectedUnit && unitDetailTab !== "linked" && !unitEditMode ? (
                      <button className="crm-secondary-button crm-small-button" onClick={() => setUnitEditMode(true)} type="button">
                        Edit
                      </button>
                    ) : null}
                  </div>
                </div>

            {!unitEditMode && selectedUnit ? renderUnitSectionView() : null}

            {unitEditMode && unitDetailTab === "identification" ? (
              <form className="crm-form crm-catalogue-form" onSubmit={onUnitSubmit}>
                <label className="crm-field crm-form-wide">
                  <span className="crm-label">Project</span>
                  <select className="crm-input" {...unitForm.register("projectId")}>
                    <option value="">Select project</option>
                    {projectRows.map((project) => <option key={project.id} value={project.id}>{project.projectCode} - {project.name}</option>)}
                  </select>
                </label>
                <label className="crm-field crm-form-wide">
                  <span className="crm-label">Unit Product</span>
                  <select className="crm-input" {...unitForm.register("productId")}>
                    <option value="">No product linked</option>
                    {productOptions.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.productCode} — {product.productName}
                      </option>
                    ))}
                  </select>
                </label>
                {!selectedUnit ? (
                  <label className="crm-check-field crm-form-wide">
                    <input type="checkbox" {...unitForm.register("applyProductDefaults")} />
                    <span>Apply product catalogue defaults on create</span>
                  </label>
                ) : null}
                {selectedUnit && unitForm.watch("productId") ? (
                  <div className="crm-form-wide">
                    <button
                      className="crm-secondary-button"
                      disabled={applyProductMutation.isPending}
                      onClick={() => {
                        const productId = unitForm.getValues("productId");
                        if (!productId) return;
                        applyProductMutation.mutate({ unitId: selectedUnit.id, productId });
                      }}
                      type="button"
                    >
                      Apply Product Defaults
                    </button>
                  </div>
                ) : null}
                <label className="crm-field"><span className="crm-label">Unit Code</span><input className="crm-input" {...unitForm.register("unitCode")} /></label>
                <label className="crm-field"><span className="crm-label">Unit Name</span><input className="crm-input" {...unitForm.register("unitName")} /></label>
                <label className="crm-field"><span className="crm-label">Inventory Code</span><input className="crm-input" {...unitForm.register("inventoryCode")} /></label>
                <label className="crm-field"><span className="crm-label">Development Phase</span><input className="crm-input" {...unitForm.register("developmentPhase")} /></label>
                <label className="crm-field"><span className="crm-label">Building Name</span><input className="crm-input" {...unitForm.register("buildingName")} /></label>
                <label className="crm-field">
                  <span className="crm-label">Block</span>
                  <select className="crm-input" {...unitForm.register("blockCode")}><option value="">Select block</option>{(blocksQuery.data ?? []).map((item) => <option key={item.id} value={item.level2Code}>{item.level2Name}</option>)}</select>
                </label>
                <label className="crm-field">
                  <span className="crm-label">Floor</span>
                  <select className="crm-input" {...unitForm.register("floorNo")}><option value="">Select floor</option>{(floorsQuery.data ?? []).map((item) => <option key={item.id} value={item.level2Code}>{item.level2Name}</option>)}</select>
                </label>
                <ReferenceSelect label="Unit Type" name="unitTypeRefId" options={unitTypesQuery.data} register={unitForm.register} />
                <ReferenceSelect label="Unit Sub-Type" name="unitSubTypeRefId" options={unitSubTypesQuery.data} register={unitForm.register} />
                <ReferenceSelect label="Stack" name="stackRefId" options={stacksQuery.data} register={unitForm.register} />
                <ReferenceSelect label="Availability" name="availabilityStatusRefId" options={availabilityStatusesQuery.data} register={unitForm.register} />
                <label className="crm-field"><span className="crm-label">Bedrooms</span><input className="crm-input" {...unitForm.register("bedroomCount")} /></label>
                <label className="crm-field"><span className="crm-label">Net Area</span><input className="crm-input" {...unitForm.register("netArea")} /></label>
                <label className="crm-field"><span className="crm-label">Gross Area</span><input className="crm-input" {...unitForm.register("grossArea")} /></label>
                <label className="crm-field"><span className="crm-label">Base Price</span><input className="crm-input" {...unitForm.register("basePrice")} /></label>
                <label className="crm-field">
                  <span className="crm-label">Currency</span>
                  <select className="crm-input" {...unitForm.register("currencyCode")}><option value="">Default project currency</option>{currencyRows.map((item) => <option key={item.id} value={item.currencyCode}>{item.currencyCode} - {item.currencyName}</option>)}</select>
                </label>
                <label className="crm-field crm-form-wide"><span className="crm-label">Remarks</span><textarea className="crm-input crm-textarea" {...unitForm.register("remarks")} /></label>
                <button className="crm-primary-button crm-form-wide" disabled={createUnitMutation.isPending || updateUnitMutation.isPending} type="submit">
                  {selectedUnit ? "Update Identification" : "Create Unit"}
                </button>
              </form>
            ) : null}

            {unitEditMode && unitDetailTab === "configuration" ? (
              <form className="crm-form crm-catalogue-form" onSubmit={configurationForm.handleSubmit((values) => saveSection("configuration", values))}>
                {configurationFields.map((field) => <label className="crm-field" key={field.name}><span className="crm-label">{field.label}</span><input className="crm-input" {...configurationForm.register(field.name)} /></label>)}
                <label className="crm-field crm-form-wide"><span className="crm-label">Remarks</span><textarea className="crm-input crm-textarea" {...configurationForm.register("remarks")} /></label>
                <button className="crm-primary-button crm-form-wide" disabled={!selectedUnit || sectionMutation.isPending} type="submit">Save Configuration</button>
              </form>
            ) : null}

            {unitEditMode && unitDetailTab === "area" ? (
              <form className="crm-form crm-catalogue-form" onSubmit={areaForm.handleSubmit((values) => saveSection("area", values))}>
                <label className="crm-field"><span className="crm-label">Area UOM</span><select className="crm-input" {...areaForm.register("areaUom")}><option value="SQM">Square Meter</option><option value="SQFT">Square Feet</option></select></label>
                {areaFields.map((field) => <label className="crm-field" key={field.name}><span className="crm-label">{field.label}</span><input className="crm-input" {...areaForm.register(field.name)} /></label>)}
                <label className="crm-field crm-form-wide"><span className="crm-label">Remarks</span><textarea className="crm-input crm-textarea" {...areaForm.register("remarks")} /></label>
                <button className="crm-primary-button crm-form-wide" disabled={!selectedUnit || sectionMutation.isPending} type="submit">Save Area Schedule</button>
              </form>
            ) : null}

            {unitEditMode && unitDetailTab === "location" ? (
              <form className="crm-form" onSubmit={locationForm.handleSubmit((values) => saveSection("location", values))}>
                <div className="crm-two-col">
                  <ReferenceSelect label="View Type" name="viewTypeRefId" options={viewTypesQuery.data} register={locationForm.register} />
                  <ReferenceSelect label="Orientation" name="orientationRefId" options={orientationsQuery.data} register={locationForm.register} />
                </div>
                <div className="crm-check-grid">
                  {[
                    ["Ocean Front", "oceanFront"], ["Ocean View", "oceanView"], ["Partial Ocean View", "partialOceanView"], ["Garden View", "gardenView"], ["Pool View", "poolView"], ["Corner Unit", "cornerUnit"], ["End Unit", "endUnit"], ["Premium Stack", "premiumStack"], ["Penthouse Level", "penthouseLevel"], ["Ocean Oriented Design", "oceanOrientedDesign"], ["Cross Ventilation", "crossVentilation"], ["Natural Daylighting", "naturalDaylighting"]
                  ].map(([label, name]) => <CheckField key={name} label={label} name={name} register={locationForm.register} />)}
                </div>
                <label className="crm-field"><span className="crm-label">Remarks</span><textarea className="crm-input crm-textarea" {...locationForm.register("remarks")} /></label>
                <button className="crm-primary-button" disabled={!selectedUnit || sectionMutation.isPending} type="submit">Save View & Location</button>
              </form>
            ) : null}

            {unitEditMode && unitDetailTab === "parking" ? (
              <form className="crm-form" onSubmit={parkingForm.handleSubmit((values) => saveSection("parking", values))}>
                <div className="crm-two-col">
                  <ReferenceSelect label="Parking Allocation" name="parkingAllocationRefId" options={parkingAllocationsQuery.data} register={parkingForm.register} />
                  <ReferenceSelect label="Parking Type" name="parkingTypeRefId" options={parkingTypesQuery.data} register={parkingForm.register} />
                  <label className="crm-field"><span className="crm-label">Parking Bay Number</span><input className="crm-input" {...parkingForm.register("parkingBayNumber")} /></label>
                  <ReferenceSelect label="Storage Allocation" name="storageAllocationRefId" options={storageAllocationsQuery.data} register={parkingForm.register} />
                  <label className="crm-field"><span className="crm-label">Storage Locker Number</span><input className="crm-input" {...parkingForm.register("storageLockerNumber")} /></label>
                </div>
                <div className="crm-check-grid">
                  <CheckField label="EV Charging Provision" name="evChargingProvision" register={parkingForm.register} />
                  <CheckField label="Storage Locker" name="storageLocker" register={parkingForm.register} />
                </div>
                <label className="crm-field"><span className="crm-label">Remarks</span><textarea className="crm-input crm-textarea" {...parkingForm.register("remarks")} /></label>
                <button className="crm-primary-button" disabled={!selectedUnit || sectionMutation.isPending} type="submit">Save Parking & Storage</button>
              </form>
            ) : null}

            {unitEditMode && unitDetailTab === "specification" ? (
              <form className="crm-form" onSubmit={specificationForm.handleSubmit((values) => saveSection("specification", values))}>
                <div className="crm-two-col">
                  <ReferenceSelect label="Automation Package" name="homeAutomationPackageRefId" options={automationPackagesQuery.data} register={specificationForm.register} />
                  <ReferenceSelect label="Appliance Package" name="premiumAppliancePackageRefId" options={appliancePackagesQuery.data} register={specificationForm.register} />
                  <ReferenceSelect label="Floor Finish" name="floorFinishTypeRefId" options={finishTypesQuery.data} register={specificationForm.register} />
                  <ReferenceSelect label="Kitchen Finish" name="kitchenFinishTypeRefId" options={finishTypesQuery.data} register={specificationForm.register} />
                  <ReferenceSelect label="Bathroom Finish" name="bathroomFinishTypeRefId" options={finishTypesQuery.data} register={specificationForm.register} />
                  <label className="crm-field"><span className="crm-label">Ceiling Height</span><input className="crm-input" {...specificationForm.register("ceilingHeight")} /></label>
                </div>
                <div className="crm-check-grid">
                  {[
                    ["Smart Home Ready", "smartHomeReady"], ["Floor-to-Ceiling Glass", "floorToCeilingGlass"], ["High-Speed Internet Ready", "highSpeedInternetReady"], ["Energy Efficient Fixtures", "energyEfficientFixtures"], ["Private Lift Access", "privateLiftAccess"], ["Private Lift Lobby", "privateLiftLobby"], ["Private Pool", "privatePool"], ["Private Jacuzzi", "privateJacuzzi"], ["BBQ Area", "bbqArea"], ["Entertainment Terrace", "entertainmentTerrace"]
                  ].map(([label, name]) => <CheckField key={name} label={label} name={name} register={specificationForm.register} />)}
                </div>
                <label className="crm-field"><span className="crm-label">Remarks</span><textarea className="crm-input crm-textarea" {...specificationForm.register("remarks")} /></label>
                <button className="crm-primary-button" disabled={!selectedUnit || sectionMutation.isPending} type="submit">Save Specification</button>
              </form>
            ) : null}

            {unitEditMode && unitDetailTab === "sales" ? (
              <form className="crm-form crm-catalogue-form" onSubmit={salesForm.handleSubmit((values) => saveSection("sales", values))}>
                <label className="crm-field">
                  <span className="crm-label">Launch Date</span>
                  <Controller
                    control={salesForm.control}
                    name="launchDate"
                    render={({ field }) => (
                      <DateField onBlur={field.onBlur} onChange={field.onChange} ref={field.ref} value={field.value} />
                    )}
                  />
                </label>
                <label className="crm-field">
                  <span className="crm-label">Sales Release Date</span>
                  <Controller
                    control={salesForm.control}
                    name="salesReleaseDate"
                    render={({ field }) => (
                      <DateField onBlur={field.onBlur} onChange={field.onChange} ref={field.ref} value={field.value} />
                    )}
                  />
                </label>
                <label className="crm-field"><span className="crm-label">Base Selling Price</span><input className="crm-input" {...salesForm.register("baseSellingPrice")} /></label>
                <label className="crm-field"><span className="crm-label">Premium Amount</span><input className="crm-input" {...salesForm.register("premiumAmount")} /></label>
                <label className="crm-field"><span className="crm-label">Discount Ceiling %</span><input className="crm-input" {...salesForm.register("discountCeilingPct")} /></label>
                <label className="crm-field"><span className="crm-label">Approved Selling Price</span><input className="crm-input" {...salesForm.register("approvedSellingPrice")} /></label>
                <label className="crm-field"><span className="crm-label">Reservation Amount</span><input className="crm-input" {...salesForm.register("reservationAmount")} /></label>
                <label className="crm-field"><span className="crm-label">Current Market Value</span><input className="crm-input" {...salesForm.register("currentMarketValue")} /></label>
                <ReferenceSelect label="Sales Status" name="salesStatusRefId" options={salesStatusesQuery.data} register={salesForm.register} />
                <label className="crm-field crm-form-wide"><span className="crm-label">Remarks</span><textarea className="crm-input crm-textarea" {...salesForm.register("remarks")} /></label>
                <button className="crm-primary-button crm-form-wide" disabled={!selectedUnit || sectionMutation.isPending} type="submit">Save Sales Information</button>
              </form>
            ) : null}

            {unitEditMode && unitDetailTab === "linked" ? (
              selectedUnit ? (
                <div className="crm-linked-module-grid">
                  <article><strong>Reservation</strong><span>{selectedUnit.reservationStatus.name ?? "No active reservation"}</span></article>
                  <article><strong>SPA / Contract</strong><span>Linked from Contracts workspace</span></article>
                  <article><strong>Collections</strong><span>Separate management module planned</span></article>
                  <article><strong>Handover</strong><span>Separate management module planned</span></article>
                  <article><strong>Title Transfer</strong><span>Separate management module planned</span></article>
                  <article><strong>Investor Reporting</strong><span>Separate BI/reporting module planned</span></article>
                </div>
              ) : <p className="crm-muted-text">Select a unit to view linked modules.</p>
            ) : null}
              </section>
            </div>
          </section>
            </div>
          ) : null}
        </section>
      ) : null}

      {productModalOpen && selectedProduct ? (
        <div className="crm-modal-backdrop" role="presentation">
          <section aria-modal="true" className="crm-modal crm-management-modal crm-opportunity-detail-modal crm-product-modal" role="dialog">
            <div className="crm-panel-header">
              <div>
                <h3>{productModalMode === "edit" ? "Edit Product" : "Product Details"}</h3>
                <p className="crm-muted-text">
                  {selectedProduct.productCode} · {selectedProduct.productName}
                </p>
              </div>
              <div className="crm-dashboard-actions">
                {productModalMode === "view" ? (
                  <button className="crm-secondary-button crm-fit-button" onClick={() => setProductModalMode("edit")} type="button">
                    Edit
                  </button>
                ) : null}
                <button className="crm-secondary-button crm-fit-button" onClick={closeProductModal} type="button">
                  Close
                </button>
              </div>
            </div>

            <div className="crm-opportunity-detail-body">
              {productModalMode === "edit" ? (
                <form className="crm-form" onSubmit={onProductSubmit}>
                  <label className="crm-field">
                    <span className="crm-label">Product Code</span>
                    <input className="crm-input" disabled value={selectedProduct.productCode} />
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Product Name</span>
                    <input className="crm-input" {...productForm.register("productName")} />
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Target Buyer</span>
                    <input className="crm-input" {...productForm.register("targetBuyer")} />
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Typical Floor</span>
                    <input className="crm-input" {...productForm.register("typicalFloorLocation")} />
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Typical View</span>
                    <input className="crm-input" {...productForm.register("typicalView")} />
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Buyer Profile</span>
                    <input className="crm-input" {...productForm.register("typicalBuyerProfile")} />
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Rate Band</span>
                    <input className="crm-input" {...productForm.register("targetRateBand")} />
                  </label>
                  <label className="crm-field crm-form-wide">
                    <span className="crm-label">Remarks</span>
                    <textarea className="crm-input crm-textarea" {...productForm.register("remarks")} />
                  </label>
                  <div className="crm-modal-actions">
                    <button className="crm-secondary-button" onClick={() => setProductModalMode("view")} type="button">
                      Cancel
                    </button>
                    <button className="crm-primary-button" disabled={updateProductMutation.isPending} type="submit">
                      {updateProductMutation.isPending ? "Saving..." : "Save Product"}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <h4 className="crm-section-title">Commercial Profile</h4>
                  <dl className="crm-detail-list crm-unit-view-grid">
                    <div><dt>Type</dt><dd>{selectedProduct.unitType.name ?? "-"}</dd></div>
                    <div><dt>Bedrooms</dt><dd>{selectedProduct.bedroomCount ?? "-"}</dd></div>
                    <div><dt>Target Buyer</dt><dd>{selectedProduct.targetBuyer ?? "-"}</dd></div>
                    <div><dt>Typical Floor</dt><dd>{selectedProduct.typicalFloorLocation ?? "-"}</dd></div>
                    <div><dt>Typical View</dt><dd>{selectedProduct.typicalView ?? "-"}</dd></div>
                    <div><dt>Buyer Profile</dt><dd>{selectedProduct.typicalBuyerProfile ?? "-"}</dd></div>
                    <div><dt>Ownership</dt><dd>{selectedProduct.ownershipType.name ?? "-"}</dd></div>
                    <div><dt>Sale Category</dt><dd>{selectedProduct.saleInventoryCategory.name ?? "-"}</dd></div>
                    <div><dt>Rental Pool</dt><dd>{selectedProduct.rentalPoolEligibility.name ?? "-"}</dd></div>
                    <div><dt>Investor Appeal</dt><dd>{selectedProduct.investorRentalAppeal.name ?? "-"}</dd></div>
                    <div><dt>Resale Potential</dt><dd>{selectedProduct.resalePotential.name ?? "-"}</dd></div>
                    <div><dt>Inventory Priority</dt><dd>{selectedProduct.inventoryPriority.name ?? "-"}</dd></div>
                    <div><dt>Rate Band</dt><dd>{selectedProduct.targetRateBand ?? "-"}</dd></div>
                    <div><dt>Parking</dt><dd>{`${selectedProduct.parkingBaysMin ?? "-"}${selectedProduct.parkingBaysMax != null && selectedProduct.parkingBaysMax !== selectedProduct.parkingBaysMin ? `-${selectedProduct.parkingBaysMax}` : ""} bay · ${selectedProduct.parkingPricingMode.name ?? "Bay Fee"}`}</dd></div>
                    <div><dt>Overall Unit Size</dt><dd>{selectedProduct.overallSizeSource === "SALEABLE_AREA" ? "Total Saleable Area" : selectedProduct.overallSizeSource}</dd></div>
                    <div><dt>Powder Room</dt><dd>{selectedProduct.powderRoomDefinition === "HALF_BATH" ? "Half-bath" : selectedProduct.powderRoomDefinition}</dd></div>
                    <div className="crm-field-span-all"><dt>Remarks</dt><dd>{selectedProduct.remarks ?? "-"}</dd></div>
                  </dl>

                  <h4 className="crm-section-title">Standard Room Layout</h4>
                  <p className="crm-muted-text">These quantities are applied when a unit is linked to this product and defaults are applied.</p>
                  <dl className="crm-detail-list crm-unit-view-grid">
                    {configurationFields.map((field) => {
                      const configuration = (selectedProduct.defaultsJson?.configuration ?? {}) as Record<string, unknown>;
                      return (
                        <div key={field.name}>
                          <dt>{field.label}</dt>
                          <dd>{formatCatalogueValue(configuration[field.name])}</dd>
                        </div>
                      );
                    })}
                    {configurationNoteLabels.map((field) => {
                      const configuration = (selectedProduct.defaultsJson?.configuration ?? {}) as Record<string, unknown>;
                      const value = configuration[field.key];
                      if (value == null || value === "") return null;
                      return (
                        <div key={field.key}>
                          <dt>{field.label}</dt>
                          <dd>{formatCatalogueValue(value)}</dd>
                        </div>
                      );
                    })}
                  </dl>

                  <h4 className="crm-section-title">Specification Defaults</h4>
                  <dl className="crm-detail-list crm-unit-view-grid">
                    {specificationDefaultLabels.map((field) => {
                      const specification = (selectedProduct.defaultsJson?.specification ?? {}) as Record<string, unknown>;
                      return (
                        <div key={field.key}>
                          <dt>{field.label}</dt>
                          <dd>{formatCatalogueValue(specification[field.key])}</dd>
                        </div>
                      );
                    })}
                  </dl>

                  <h4 className="crm-section-title">Location Defaults</h4>
                  <dl className="crm-detail-list crm-unit-view-grid">
                    {locationDefaultLabels.map((field) => {
                      const location = (selectedProduct.defaultsJson?.locationAttributes ?? {}) as Record<string, unknown>;
                      return (
                        <div key={field.key}>
                          <dt>{field.label}</dt>
                          <dd>{formatCatalogueValue(location[field.key])}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {projectModalOpen ? (
        <div className="crm-modal-backdrop" role="presentation">
          <section aria-modal="true" className="crm-modal crm-management-modal crm-opportunity-detail-modal crm-project-modal" role="dialog">
            <div className="crm-panel-header">
              <div>
                <h3>{selectedProject ? "Edit Project" : "Create Project"}</h3>
                <p className="crm-muted-text">
                  {selectedProject
                    ? `${selectedProject.projectCode} · ${selectedProject.name}`
                    : "Add a project before creating units in inventory."}
                </p>
              </div>
              <button className="crm-secondary-button crm-fit-button" onClick={closeProjectModal} type="button">
                Close
              </button>
            </div>
            <form className="crm-opportunity-detail-body crm-form" onSubmit={onProjectSubmit}>
              <label className="crm-field">
                <span className="crm-label">Project Code</span>
                <input className="crm-input" {...projectForm.register("projectCode")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Project Name</span>
                <input className="crm-input" {...projectForm.register("name")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Location</span>
                <input className="crm-input" {...projectForm.register("locationCode")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Currency</span>
                <select className="crm-input crm-select-full" {...projectForm.register("currencyCode")}>
                  <option value="">Select currency</option>
                  {currencyRows.map((item) => (
                    <option key={item.id} value={item.currencyCode}>
                      {item.currencyCode} - {item.currencyName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="crm-field">
                <span className="crm-label">Legal Entity</span>
                <input className="crm-input" {...projectForm.register("legalEntityCode")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Description</span>
                <textarea className="crm-input crm-textarea" {...projectForm.register("description")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Remarks</span>
                <textarea className="crm-input crm-textarea" {...projectForm.register("remarks")} />
              </label>
              <div className="crm-modal-actions">
                <button className="crm-secondary-button" onClick={closeProjectModal} type="button">
                  Cancel
                </button>
                <button className="crm-primary-button" disabled={createProjectMutation.isPending || updateProjectMutation.isPending} type="submit">
                  {selectedProject
                    ? updateProjectMutation.isPending
                      ? "Updating..."
                      : "Update Project"
                    : createProjectMutation.isPending
                      ? "Creating..."
                      : "Create Project"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
