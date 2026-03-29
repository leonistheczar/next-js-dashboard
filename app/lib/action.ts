"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import postgres from "postgres";
import { z } from "zod";
const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });
const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: `Please select a customer`
  }),
  amount: z.coerce.number().gt(0,{
    message: `Please input an amount greater than $0.`
  }),
  status: z.enum(["pending", "paid"], {
    invalid_type_error: `Please select an invoice status`
  }),
  date: z.string(),
});
export type State = {
  errors?:{
    customerId?: string[],
    amount?: string[],
    status?: string[],
  };
  message?: string | null;
};
const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });
// Create a new invoice
export async function createInvoice(prevState: State, formData: FormData) {
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });
  if(!validatedFields.success){
    return{
      errors: validatedFields.error.flatten().fieldErrors,
      message: `Missing fields. Failed to create an invoice`
    }
  }
  const {customerId, amount, status} = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split("T")[0];
  try {
    // Creating query
    await sql`INSERT INTO invoices (customer_id, amount, status, date)
                   VALUES (${customerId}, ${amountInCents}, ${status}, ${date})`;
  } catch (err) {
    console.error(err);
    throw new Error(`Database Error: Failed to create this invoice`);
  }
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}
// Update invoice
export async function updateInvoice(id: string, prevState: State, formData: FormData) {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });
  if(!validatedFields.success){
    return{
      errors: validatedFields.error.flatten().fieldErrors,
      message: `Missing fields. Failed to create an invoice`
    }
  }
  const {customerId, amount, status} = validatedFields.data;
  const amountInCents = amount * 100;
  try {
    await sql`UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}`;
  } catch (err) {
    console.error(err);
    return { message: `Database Error: Failed to update this invoice` };
  }
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}
// Delete invoice
export async function deleteInvoice(id: string) {
  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
  } catch (err) {
    console.error(err);
    return {
      message: `Database Error: Failed to delete this invoice`,
    };
  }
  revalidatePath("/dashboard/invoices");
}
