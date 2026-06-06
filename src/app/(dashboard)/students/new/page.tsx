import { StudentForm } from "@/components/student/student-form";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";

export default function NewStudentPage() {
  return (
    <div>
      <Breadcrumb>
        <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
        <BreadcrumbItem href="/students">Students</BreadcrumbItem>
        <BreadcrumbItem>Direct Intake</BreadcrumbItem>
      </Breadcrumb>

      <h1 className="text-headline-md font-semibold text-on-surface mb-6">
        Direct Intake / Data Migration
      </h1>

      {/* Migration Alert Warning Banner */}
      <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 flex gap-3 text-amber-800 text-body-sm mb-6 items-start shadow-sm shadow-amber-50">
        <span className="material-symbols-outlined text-amber-600 shrink-0 select-none">warning</span>
        <div>
          <p className="font-bold">डेटा मायग्रेशन / थेट प्रवेश मोड (Data Migration Mode)</p>
          <p className="text-xs text-amber-700/90 mt-0.5">
            या फॉर्मचा वापर केवळ शाळेतील विद्यमान जुन्या विद्यार्थ्यांचा डेटा लोड करण्यासाठी किंवा थेट मधल्या वर्षात बदली (Transfer Intake) झालेल्या विद्यार्थ्यांसाठीच करा. नवीन शैक्षणिक वर्षातील सर्व नियमित प्रवेश केवळ <strong>Admissions Desk</strong> द्वारे केले जाणे बंधनकारक आहे.
          </p>
        </div>
      </div>

      <StudentForm mode="create" />
    </div>
  );
}
