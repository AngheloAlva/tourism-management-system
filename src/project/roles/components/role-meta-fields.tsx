import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"

interface RoleMetaFieldsProps {
	name: string
	description: string
	onNameChange: (value: string) => void
	onDescriptionChange: (value: string) => void
}

export function RoleMetaFields({
	name,
	description,
	onNameChange,
	onDescriptionChange,
}: RoleMetaFieldsProps) {
	return (
		<>
			<div className="space-y-1">
				<Label>Nombre</Label>
				<Input value={name} onChange={(event) => onNameChange(event.target.value)} />
			</div>
			<div className="space-y-1">
				<Label>Descripcion</Label>
				<Input value={description} onChange={(event) => onDescriptionChange(event.target.value)} />
			</div>
		</>
	)
}
