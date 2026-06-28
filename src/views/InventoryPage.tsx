import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type UseFormRegister } from "react-hook-form";
import {
  createProject,
  createUnit,
  getProject,
  getUnit,
  listProjects,
  listUnits,
  updateProject,
  updateUnit,
  upsertUnitAreaSchedule,
  upsertUnitConfiguration,
  upsertUnitLocationAttributes,
  upsertUnitParkingStorage,
  upsertUnitSalesInformation,
  upsertUnitSpecification,
  type Project,
  type Unit
} from "../api/inventory";
import { listCurrencies } from "../api/currencies";
import { getReferenceFamily, type ReferenceDataItem } from "../api/reference-data";

type InventoryTab = "projects" | "units" | "availability";
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

function money(value: number | null, currencyCode: string | null) {
  if (value === null) return "-";
  return `${value.toLocaleString()} ${currencyCode ?? ""}`.trim();
}

function area(value: number | null) {
  return value === null ? "-" : value.toLocaleString();
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
  const [activeTab, setActiveTab] = useState<InventoryTab>("projects");
  const [unitDetailTab, setUnitDetailTab] = useState<UnitDetailTab>("identification");
  const [search, setSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const projectForm = useForm<ProjectFormValues>({
    defaultValues: { projectCode: "", name: "", locationCode: "", legalEntityCode: "", currencyCode: "USD", description: "", remarks: "" }
  });
  const unitForm = useForm<UnitFormValues>({
    defaultValues: {
      projectId: "",
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
      currencyCode: "USD",
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

  const projectsQuery = useQuery({ queryKey: ["inventory", "projects", search], queryFn: () => listProjects(search), staleTime: 10_000 });
  const unitsQuery = useQuery({ queryKey: ["inventory", "units", search], queryFn: () => listUnits(search), staleTime: 10_000 });
  const selectedProjectQuery = useQuery({ queryKey: ["inventory", "project", selectedProjectId], queryFn: () => getProject(selectedProjectId ?? ""), enabled: Boolean(selectedProjectId) });
  const selectedUnitQuery = useQuery({ queryKey: ["inventory", "unit", selectedUnitId], queryFn: () => getUnit(selectedUnitId ?? ""), enabled: Boolean(selectedUnitId) });
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
  const currencyRows = currenciesQuery.data?.items ?? [];
  const selectedProject = selectedProjectQuery.data;
  const selectedUnit = selectedUnitQuery.data;

  const stats = useMemo(() => {
    const totalUnits = unitsQuery.data?.pagination.total ?? 0;
    const available = unitRows.filter((unit) => unit.availabilityStatus.code === "AVAILABLE").length;
    const reserved = unitRows.filter((unit) => unit.availabilityStatus.code === "RESERVED").length;
    const value = unitRows.reduce((sum, unit) => sum + (unit.basePrice ?? 0), 0);
    return { projects: projectsQuery.data?.pagination.total ?? 0, units: totalUnits, available, reserved, value };
  }, [projectsQuery.data?.pagination.total, unitRows, unitsQuery.data?.pagination.total]);

  const refreshInventory = (successMessage: string) => {
    setMessage(successMessage);
    void queryClient.invalidateQueries({ queryKey: ["inventory"] });
  };

  useEffect(() => {
    if (!selectedUnit) return;
    unitForm.reset({
      projectId: selectedUnit.project.id,
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
    onSuccess: (project) => {
      setSelectedProjectId(project.id);
      projectForm.reset({ projectCode: "", name: "", locationCode: "", legalEntityCode: "", currencyCode: "USD", description: "", remarks: "" });
      refreshInventory("Project saved.");
    },
    onError: () => setMessage("Project could not be saved. Check code and required fields.")
  });
  const updateProjectMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ProjectFormValues }) => updateProject(id, projectPayload(values)),
    onSuccess: (project) => {
      setSelectedProjectId(project.id);
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
    if (selectedProject && activeTab === "projects") updateProjectMutation.mutate({ id: selectedProject.id, values });
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
      currencyCode: project.currencyCode ?? "USD",
      description: project.description ?? "",
      remarks: project.remarks ?? ""
    });
  };

  const loadUnitForm = (unit: Unit) => {
    setActiveTab("units");
    setSelectedUnitId(unit.id);
    setUnitDetailTab("identification");
  };

  const resetUnitForm = () => {
    setSelectedUnitId(null);
    setUnitDetailTab("identification");
    unitForm.reset({
      projectId: "",
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
      currencyCode: "USD",
      availabilityStatusRefId: "",
      remarks: ""
    });
  };

  return (
    <div className="crm-workspace">
      <section className="crm-module-header">
        <div>
          <p className="crm-eyebrow">Inventory</p>
          <h2>Projects and Units</h2>
        </div>
      </section>

      <section className="crm-grid crm-metric-grid">
        <article className="crm-card"><h3>Projects</h3><div className="crm-kpi">{stats.projects}</div></article>
        <article className="crm-card"><h3>Units</h3><div className="crm-kpi">{stats.units}</div></article>
        <article className="crm-card"><h3>Available</h3><div className="crm-kpi">{stats.available}</div></article>
        <article className="crm-card"><h3>Value</h3><div className="crm-kpi">{stats.value.toLocaleString()}</div></article>
      </section>

      {message ? <div className={message.includes("could not") ? "crm-error-banner" : "crm-info-banner"}>{message}</div> : null}

      <section className="crm-tabs" aria-label="Inventory management tabs">
        {[
          { id: "projects", label: "Projects" },
          { id: "units", label: "Units" },
          { id: "availability", label: "Availability" }
        ].map((tab) => (
          <button className={`crm-tab-button${activeTab === tab.id ? " is-active" : ""}`} key={tab.id} onClick={() => setActiveTab(tab.id as InventoryTab)} type="button">
            {tab.label}
          </button>
        ))}
      </section>

      {activeTab === "projects" ? (
        <section className="crm-action-grid crm-inventory-grid">
          <section className="crm-panel">
            <div className="crm-panel-header">
              <h3>Project Register</h3>
              <input className="crm-input crm-search-input" onChange={(event) => setSearch(event.target.value)} placeholder="Search project, location" value={search} />
            </div>
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead><tr><th>Project</th><th>Location</th><th>Currency</th><th>Status</th></tr></thead>
                <tbody>
                  {projectRows.map((project) => (
                    <tr className={selectedProjectId === project.id ? "is-selected" : ""} key={project.id} onClick={() => loadProjectForm(project)}>
                      <td><strong>{project.projectCode}</strong><span>{project.name}</span></td>
                      <td>{project.locationCode ?? "-"}</td>
                      <td>{project.currencyCode ?? "-"}</td>
                      <td>{project.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <form className="crm-panel crm-form" onSubmit={onProjectSubmit}>
            <div className="crm-panel-header">
              <h3>{selectedProject ? "Edit Project" : "Create Project"}</h3>
              <button className="crm-secondary-button crm-fit-button" onClick={() => {
                setSelectedProjectId(null);
                projectForm.reset({ projectCode: "", name: "", locationCode: "", legalEntityCode: "", currencyCode: "USD", description: "", remarks: "" });
              }} type="button">New</button>
            </div>
            <label className="crm-field"><span className="crm-label">Project Code</span><input className="crm-input" {...projectForm.register("projectCode")} /></label>
            <label className="crm-field"><span className="crm-label">Project Name</span><input className="crm-input" {...projectForm.register("name")} /></label>
            <div className="crm-two-col">
              <label className="crm-field"><span className="crm-label">Location</span><input className="crm-input" {...projectForm.register("locationCode")} /></label>
              <label className="crm-field">
                <span className="crm-label">Currency</span>
                <select className="crm-input" {...projectForm.register("currencyCode")}>
                  <option value="">Select currency</option>
                  {currencyRows.map((item) => <option key={item.id} value={item.currencyCode}>{item.currencyCode} - {item.currencyName}</option>)}
                </select>
              </label>
            </div>
            <label className="crm-field"><span className="crm-label">Legal Entity</span><input className="crm-input" {...projectForm.register("legalEntityCode")} /></label>
            <label className="crm-field"><span className="crm-label">Description</span><textarea className="crm-input crm-textarea" {...projectForm.register("description")} /></label>
            <button className="crm-primary-button" disabled={createProjectMutation.isPending || updateProjectMutation.isPending} type="submit">
              {selectedProject ? "Update Project" : "Create Project"}
            </button>
          </form>
        </section>
      ) : null}

      {activeTab === "units" || activeTab === "availability" ? (
        <section className="crm-action-grid crm-unit-catalogue-grid">
          <section className="crm-panel">
            <div className="crm-panel-header">
              <h3>{activeTab === "units" ? "Unit Register" : "Availability Register"}</h3>
              <input className="crm-input crm-search-input" onChange={(event) => setSearch(event.target.value)} placeholder="Search unit, project, status" value={search} />
            </div>
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead><tr><th>Unit</th><th>Project</th><th>Type</th><th>Price</th><th>Status</th></tr></thead>
                <tbody>
                  {unitRows.map((unit) => (
                    <tr className={selectedUnitId === unit.id ? "is-selected" : ""} key={unit.id} onClick={() => loadUnitForm(unit)}>
                      <td><strong>{unit.unitCode}</strong><span>{unit.unitName ?? "Unit"}</span></td>
                      <td><strong>{unit.project.projectCode}</strong><span>{unit.project.name ?? "-"}</span></td>
                      <td>{unit.unitType.name ?? "-"}</td>
                      <td>{money(unit.basePrice, unit.currencyCode)}</td>
                      <td><span className={`crm-status-pill crm-status-${unit.availabilityStatus.code?.toLowerCase() ?? "default"}`}>{unit.availabilityStatus.name ?? unit.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="crm-panel crm-unit-catalogue-panel">
            <div className="crm-panel-header">
              <div>
                <h3>{selectedUnit ? selectedUnit.unitCode : "Create Unit"}</h3>
                <p className="crm-muted-text">{selectedUnit ? `${selectedUnit.project.projectCode ?? "-"} · ${selectedUnit.unitName ?? "Unit"}` : "Create the unit first, then complete catalogue sections."}</p>
              </div>
              <button className="crm-secondary-button crm-fit-button" onClick={resetUnitForm} type="button">New</button>
            </div>

            <section className="crm-tabs crm-subtabs" aria-label="Unit catalogue tabs">
              {unitDetailTabs.map((tab) => (
                <button className={`crm-tab-button${unitDetailTab === tab.id ? " is-active" : ""}`} key={tab.id} onClick={() => setUnitDetailTab(tab.id)} type="button">
                  {tab.label}
                </button>
              ))}
            </section>

            {unitDetailTab === "identification" ? (
              <form className="crm-form crm-catalogue-form" onSubmit={onUnitSubmit}>
                <label className="crm-field crm-form-wide">
                  <span className="crm-label">Project</span>
                  <select className="crm-input" {...unitForm.register("projectId")}>
                    <option value="">Select project</option>
                    {projectRows.map((project) => <option key={project.id} value={project.id}>{project.projectCode} - {project.name}</option>)}
                  </select>
                </label>
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

            {unitDetailTab === "configuration" ? (
              <form className="crm-form crm-catalogue-form" onSubmit={configurationForm.handleSubmit((values) => saveSection("configuration", values))}>
                {configurationFields.map((field) => <label className="crm-field" key={field.name}><span className="crm-label">{field.label}</span><input className="crm-input" {...configurationForm.register(field.name)} /></label>)}
                <label className="crm-field crm-form-wide"><span className="crm-label">Remarks</span><textarea className="crm-input crm-textarea" {...configurationForm.register("remarks")} /></label>
                <button className="crm-primary-button crm-form-wide" disabled={!selectedUnit || sectionMutation.isPending} type="submit">Save Configuration</button>
              </form>
            ) : null}

            {unitDetailTab === "area" ? (
              <form className="crm-form crm-catalogue-form" onSubmit={areaForm.handleSubmit((values) => saveSection("area", values))}>
                <label className="crm-field"><span className="crm-label">Area UOM</span><select className="crm-input" {...areaForm.register("areaUom")}><option value="SQM">Square Meter</option><option value="SQFT">Square Feet</option></select></label>
                {areaFields.map((field) => <label className="crm-field" key={field.name}><span className="crm-label">{field.label}</span><input className="crm-input" {...areaForm.register(field.name)} /></label>)}
                <label className="crm-field crm-form-wide"><span className="crm-label">Remarks</span><textarea className="crm-input crm-textarea" {...areaForm.register("remarks")} /></label>
                <button className="crm-primary-button crm-form-wide" disabled={!selectedUnit || sectionMutation.isPending} type="submit">Save Area Schedule</button>
              </form>
            ) : null}

            {unitDetailTab === "location" ? (
              <form className="crm-form" onSubmit={locationForm.handleSubmit((values) => saveSection("location", values))}>
                <div className="crm-two-col">
                  <ReferenceSelect label="View Type" name="viewTypeRefId" options={viewTypesQuery.data} register={locationForm.register} />
                  <ReferenceSelect label="Orientation" name="orientationRefId" options={orientationsQuery.data} register={locationForm.register} />
                </div>
                <div className="crm-check-grid">
                  {[
                    ["Ocean Front", "oceanFront"], ["Ocean View", "oceanView"], ["Partial Ocean View", "partialOceanView"], ["Garden View", "gardenView"], ["Pool View", "poolView"], ["Corner Unit", "cornerUnit"], ["End Unit", "endUnit"], ["Premium Stack", "premiumStack"], ["Penthouse Level", "penthouseLevel"]
                  ].map(([label, name]) => <CheckField key={name} label={label} name={name} register={locationForm.register} />)}
                </div>
                <label className="crm-field"><span className="crm-label">Remarks</span><textarea className="crm-input crm-textarea" {...locationForm.register("remarks")} /></label>
                <button className="crm-primary-button" disabled={!selectedUnit || sectionMutation.isPending} type="submit">Save View & Location</button>
              </form>
            ) : null}

            {unitDetailTab === "parking" ? (
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

            {unitDetailTab === "specification" ? (
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

            {unitDetailTab === "sales" ? (
              <form className="crm-form crm-catalogue-form" onSubmit={salesForm.handleSubmit((values) => saveSection("sales", values))}>
                <label className="crm-field"><span className="crm-label">Launch Date</span><input className="crm-input" type="date" {...salesForm.register("launchDate")} /></label>
                <label className="crm-field"><span className="crm-label">Sales Release Date</span><input className="crm-input" type="date" {...salesForm.register("salesReleaseDate")} /></label>
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

            {unitDetailTab === "linked" ? (
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
        </section>
      ) : null}
    </div>
  );
}
